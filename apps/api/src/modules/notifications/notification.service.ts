import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
  Prisma,
  PrismaClient,
  Role,
} from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import type { NotificationEvent } from "./notification.events.js";
import { enqueueNotificationEvent } from "./notification.queue.js";
import {
  notificationRules,
  type NotificationAudience,
  type NotificationChannelPreference,
} from "./notification.rules.js";
import { buildNotificationTemplate } from "./notification.templates.js";

type DispatchInput = {
  prismaClient: PrismaClient | Prisma.TransactionClient;
  type: NotificationType;
  title: string;
  message: string;
  userId?: string;
  brandId?: string;
  orderId?: string;
  emailRecipient?: string | null;
  whatsappRecipient?: string | null;
  emailSubject?: string;
  emailText?: string;
  emailHtml?: string;
  whatsappPayload?: Record<string, unknown>;
};

type ResolvedRecipient = {
  audience: NotificationAudience;
  userId?: string;
  brandId?: string;
  brandName?: string;
  email?: string | null;
  whatsapp?: string | null;
  channels: NotificationChannelPreference[];
};

function mapEventToNotificationType(event: NotificationEvent): NotificationType {
  switch (event.name) {
    case "OrderPlaced":
      return NotificationType.ORDER_PLACED;
    case "OrderConfirmed":
    case "OrderPacked":
    case "OrderShipped":
    case "OrderDelivered":
    case "OrderCancelled":
    case "PaymentInitiated":
    case "PaymentSuccess":
    case "PaymentFailed":
    case "RefundProcessed":
    case "BrandApproved":
      return NotificationType.ORDER_STATUS_UPDATED;
    case "ProductSubmitted":
    case "ProductApproved":
    case "ProductRejected":
      return NotificationType.BRAND_ORDER_ASSIGNED;
    case "ReviewSubmitted":
      return NotificationType.PRODUCT_REVIEW_SUBMITTED;
    case "ReviewHelpfulVoted":
      return NotificationType.PRODUCT_REVIEW_REPLIED;
    case "ReviewReported":
      return NotificationType.PRODUCT_REVIEW_REPORTED;
    case "ReviewModerated":
      return NotificationType.PRODUCT_REVIEW_MODERATED;
    case "ReviewReplied":
      return NotificationType.PRODUCT_REVIEW_REPLIED;
    default:
      return NotificationType.ORDER_STATUS_UPDATED;
  }
}

async function sendEmailNotification(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  if (!env.resendApiKey) {
    throw new Error("Email provider is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.resendApiKey}`,
    },
    body: JSON.stringify({
      from: env.emailFromAddress,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Email provider rejected request (${response.status}): ${body.slice(0, 240)}`);
  }
}

async function withRetries(task: () => Promise<void>, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await task();
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Delivery failed");
}

function isOrderOrPaymentEvent(event: NotificationEvent) {
  return (
    event.name === "OrderPlaced" ||
    event.name === "OrderConfirmed" ||
    event.name === "OrderPacked" ||
    event.name === "OrderShipped" ||
    event.name === "OrderDelivered" ||
    event.name === "OrderCancelled" ||
    event.name === "PaymentInitiated" ||
    event.name === "PaymentSuccess" ||
    event.name === "PaymentFailed" ||
    event.name === "RefundProcessed"
  );
}

async function shouldSendEmailForRecipient(input: {
  prismaClient: PrismaClient | Prisma.TransactionClient;
  recipient: ResolvedRecipient;
  event: NotificationEvent;
}) {
  if (!input.recipient.email) return false;

  if (!input.recipient.userId || !isOrderOrPaymentEvent(input.event)) {
    return true;
  }

  const preference = await input.prismaClient.notificationPreference.findUnique({
    where: { userId: input.recipient.userId },
    select: { orderUpdates: true },
  });

  return preference?.orderUpdates !== false;
}

async function isDuplicateNotification(input: {
  prismaClient: PrismaClient | Prisma.TransactionClient;
  type: NotificationType;
  title: string;
  message: string;
  userId?: string;
  brandId?: string;
  orderId?: string;
}) {
  const recent = await input.prismaClient.notification.findFirst({
    where: {
      type: input.type,
      title: input.title,
      message: input.message,
      userId: input.userId,
      brandId: input.brandId,
      orderId: input.orderId,
      createdAt: { gte: new Date(Date.now() - 60_000) },
    },
    select: { id: true },
  });

  return Boolean(recent);
}

async function resolveRecipients(
  prismaClient: PrismaClient | Prisma.TransactionClient,
  event: NotificationEvent,
): Promise<ResolvedRecipient[]> {
  const rule = notificationRules[event.name];
  const recipients: ResolvedRecipient[] = [];
  const channelsForAudience = (audience: NotificationAudience): NotificationChannelPreference[] => {
    return rule.audienceRules.find((item) => item.audience === audience)?.channels || [];
  };
  const audiences = new Set(rule.audienceRules.map((item) => item.audience));

  const order = event.orderId
    ? await prismaClient.order.findUnique({
        where: { id: event.orderId },
        include: {
          user: { select: { id: true, email: true } },
          items: { select: { brandId: true } },
        },
      })
    : null;

  if (audiences.has("USER")) {
    const resolvedUserId = event.userId || order?.user.id;
    if (resolvedUserId) {
      const user =
        resolvedUserId === order?.user.id
          ? order.user
          : await prismaClient.user.findUnique({
              where: { id: resolvedUserId },
              select: { id: true, email: true },
            });

      if (user) {
        recipients.push({
          audience: "USER",
          userId: user.id,
          email: user.email,
          channels: channelsForAudience("USER"),
        });
      }
    }
  }

  if (audiences.has("ADMIN")) {
    const shouldSkipAdminAudience =
      (event.name === "OrderDelivered" || event.name === "OrderCancelled") &&
      "notifyAdmin" in event &&
      event.notifyAdmin === false;

    if (!shouldSkipAdminAudience) {
      const admins = await prismaClient.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true, email: true },
      });

      recipients.push(
        ...admins.map((admin) => ({
          audience: "ADMIN" as const,
          userId: admin.id,
          email: admin.email,
          channels: channelsForAudience("ADMIN"),
        })),
      );
    }
  }

  if (audiences.has("BRAND_MEMBERS")) {
    const brandIds = new Set<string>();
    if (event.brandId) {
      brandIds.add(event.brandId);
    } else if (order) {
      for (const item of order.items) {
        brandIds.add(item.brandId);
      }
    }

    if (brandIds.size > 0) {
      const brandIdList = Array.from(brandIds);
      const members = await prismaClient.brandMember.findMany({
        where: { brandId: { in: brandIdList } },
        include: {
          user: { select: { id: true, email: true } },
          brand: { select: { id: true, name: true, contactEmail: true, whatsappNumber: true } },
        },
      });

      const owners = await prismaClient.user.findMany({
        where: { brandId: { in: brandIdList } },
        select: {
          id: true,
          email: true,
          brandId: true,
          brand: { select: { id: true, name: true, contactEmail: true, whatsappNumber: true } },
        },
      });

      recipients.push(
        ...members.map((member) => ({
            audience: "BRAND_MEMBERS" as const,
            userId: member.user.id,
            brandId: member.brand.id,
            brandName: member.brand.name,
            email: member.user.email || member.brand.contactEmail,
            whatsapp: member.brand.whatsappNumber,
            channels: channelsForAudience("BRAND_MEMBERS"),
        })),
      );

      recipients.push(
        ...owners
          .filter((owner) => Boolean(owner.brandId) && Boolean(owner.brand))
          .map((owner) => ({
            audience: "BRAND_MEMBERS" as const,
            userId: owner.id,
            brandId: owner.brandId!,
            brandName: owner.brand?.name,
            email: owner.email || owner.brand?.contactEmail,
            whatsapp: owner.brand?.whatsappNumber,
            channels: channelsForAudience("BRAND_MEMBERS"),
          })),
      );
    }
  }

  const deduped = new Map<string, ResolvedRecipient>();
  for (const recipient of recipients) {
    const key = [recipient.audience, recipient.userId || "", recipient.brandId || ""].join(":");
    if (!deduped.has(key)) {
      deduped.set(key, recipient);
    }
  }

  return Array.from(deduped.values());
}

async function sendWhatsappNotification(input: {
  recipient: string;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
}) {
  if (!env.whatsappWebhookUrl) {
    throw new Error("WhatsApp webhook is not configured");
  }

  const response = await fetch(env.whatsappWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: input.recipient,
      title: input.title,
      message: input.message,
      payload: input.payload,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WhatsApp webhook rejected request (${response.status}): ${body.slice(0, 240)}`);
  }
}

export async function createNotificationWithChannels(input: DispatchInput) {
  const isDuplicate = await isDuplicateNotification({
    prismaClient: input.prismaClient,
    type: input.type,
    title: input.title,
    message: input.message,
    userId: input.userId,
    brandId: input.brandId,
    orderId: input.orderId,
  });

  if (isDuplicate) {
    return null;
  }

  const notification = await input.prismaClient.notification.create({
    data: {
      type: input.type,
      title: input.title,
      message: input.message,
      userId: input.userId,
      brandId: input.brandId,
      orderId: input.orderId,
    },
  });

  await input.prismaClient.notificationChannelLog.create({
    data: {
      notificationId: notification.id,
      channel: NotificationChannel.DASHBOARD,
      status: NotificationDeliveryStatus.SENT,
      recipient: input.userId || input.brandId || "dashboard",
    },
  });

  let emailLog: { id: string } | null = null;
  let whatsappLog: { id: string } | null = null;

  if (input.emailRecipient) {
    emailLog = await input.prismaClient.notificationChannelLog.create({
      data: {
        notificationId: notification.id,
        channel: NotificationChannel.EMAIL,
        status: NotificationDeliveryStatus.QUEUED,
        recipient: input.emailRecipient,
      },
      select: { id: true },
    });
  }

  if (input.whatsappRecipient) {
    whatsappLog = await input.prismaClient.notificationChannelLog.create({
      data: {
        notificationId: notification.id,
        channel: NotificationChannel.WHATSAPP,
        status: NotificationDeliveryStatus.QUEUED,
        recipient: input.whatsappRecipient,
      },
      select: { id: true },
    });
  }

  if (emailLog && input.emailRecipient) {
    try {
      await withRetries(async () => {
        await sendEmailNotification({
          to: input.emailRecipient!,
          subject: input.emailSubject || `[Broady] ${input.title}`,
          text: input.emailText || input.message,
          html: input.emailHtml,
        });
      });

      await input.prismaClient.notificationChannelLog.update({
        where: { id: emailLog.id },
        data: { status: NotificationDeliveryStatus.SENT, error: null },
      });
    } catch (error) {
      await input.prismaClient.notificationChannelLog.update({
        where: { id: emailLog.id },
        data: {
          status: NotificationDeliveryStatus.FAILED,
          error: error instanceof Error ? error.message.slice(0, 500) : "Email delivery failed",
        },
      });
    }
  }

  if (whatsappLog && input.whatsappRecipient) {
    try {
      await withRetries(async () => {
        await sendWhatsappNotification({
          recipient: input.whatsappRecipient!,
          title: input.title,
          message: input.message,
          payload: input.whatsappPayload,
        });
      });

      await input.prismaClient.notificationChannelLog.update({
        where: { id: whatsappLog.id },
        data: { status: NotificationDeliveryStatus.SENT, error: null },
      });
    } catch (error) {
      await input.prismaClient.notificationChannelLog.update({
        where: { id: whatsappLog.id },
        data: {
          status: NotificationDeliveryStatus.FAILED,
          error: error instanceof Error ? error.message.slice(0, 500) : "WhatsApp delivery failed",
        },
      });
    }
  }

  return notification;
}

export async function emitNotificationEvent(
  event: NotificationEvent,
  prismaClient: PrismaClient | Prisma.TransactionClient = prisma,
) {
  const orderBrandNames = event.orderId
    ? await prismaClient.order
        .findUnique({
          where: { id: event.orderId },
          select: {
            items: {
              select: {
                brand: { select: { name: true } },
              },
            },
          },
        })
        .then((order) => Array.from(new Set(order?.items.map((item) => item.brand.name).filter(Boolean) || [])))
    : undefined;

  const eventBrandName = event.brandId
    ? await prismaClient.brand
        .findUnique({
          where: { id: event.brandId },
          select: { name: true },
        })
        .then((brand) => brand?.name)
    : undefined;

  const recipients = await resolveRecipients(prismaClient, event);
  const type = mapEventToNotificationType(event);

  for (const recipient of recipients) {
    const template = buildNotificationTemplate(event, recipient.audience, {
      recipientBrandName:
        recipient.brandName || ("brandName" in event ? event.brandName : undefined) || eventBrandName || undefined,
      orderBrandNames,
    });
    const emailAllowed =
      recipient.channels.includes("EMAIL") &&
      (await shouldSendEmailForRecipient({
        prismaClient,
        recipient,
        event,
      }));

    await createNotificationWithChannels({
      prismaClient,
      type,
      title: template.title,
      message: template.message,
      userId: recipient.userId,
      brandId: recipient.brandId,
      orderId: event.orderId,
      emailRecipient: emailAllowed ? recipient.email : undefined,
      whatsappRecipient: recipient.channels.includes("WHATSAPP") ? recipient.whatsapp : undefined,
      emailSubject: `[Broady] ${template.title}`,
      emailText: template.message,
    });
  }
}

export function queueNotificationEvent(event: NotificationEvent) {
  void enqueueNotificationEvent(event).catch((error) => {
    console.error("[notifications] failed to enqueue event", {
      event: event.name,
      orderId: event.orderId,
      brandId: event.brandId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Reliability fallback: still attempt direct delivery when the queue layer is unavailable.
    void emitNotificationEvent(event).catch((directError) => {
      console.error("[notifications] failed to deliver event after enqueue fallback", {
        event: event.name,
        orderId: event.orderId,
        brandId: event.brandId,
        error: directError instanceof Error ? directError.message : String(directError),
      });
    });
  });
}
