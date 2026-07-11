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
import {
  notificationRules,
  type NotificationAudience,
  type NotificationChannelPreference,
} from "./notification.rules.js";
import { sendEmail } from "../../services/email.service.js";
import { sendPushNotification } from "./notification.push.js";
import { buildNotificationTemplate } from "./notification.templates.js";
import { resolveNotificationTargetPath } from "./notification.targets.js";

type DispatchInput = {
  prismaClient: PrismaClient | Prisma.TransactionClient;
  type: NotificationType;
  title: string;
  message: string;
  userId?: string;
  brandId?: string;
  orderId?: string;
  targetPath?: string;
  emailRecipient?: string | null;
  whatsappRecipient?: string | null;
  emailSubject?: string;
  emailText?: string;
  emailHtml?: string;
  pushTokens?: string[];
  pushData?: Record<string, unknown>;
  whatsappPayload?: Record<string, unknown>;
};

type ResolvedRecipient = {
  audience: NotificationAudience;
  userId?: string;
  brandId?: string;
  brandName?: string;
  email?: string | null;
  whatsapp?: string | null;
  pushTokens: string[];
  channels: NotificationChannelPreference[];
};

function mapEventToNotificationType(event: NotificationEvent): NotificationType {
  switch (event.name) {
    case "order_placed":
      return NotificationType.ORDER_PLACED;
    case "suborder_confirmed":
    case "suborder_processing":
    case "suborder_shipped":
    case "suborder_delivery_failed":
    case "suborder_retry_scheduled":
    case "suborder_shipment_returned":
    case "suborder_returned":
    case "suborder_delivered":
    case "suborder_cancelled":
    case "cancellation_request_created":
    case "cancellation_request_approved":
    case "cancellation_request_rejected":
    case "cancellation_request_expired":
    case "payment_initiated":
    case "payment_success":
    case "payment_failed":
    case "refund_processed":
    case "refund_state_updated":
    case "return_state_updated":
    case "brand_approved":
      return NotificationType.ORDER_STATUS_UPDATED;
    case "product_submitted":
    case "product_approved":
    case "product_rejected":
      return NotificationType.BRAND_ORDER_ASSIGNED;
    case "review_submitted":
      return NotificationType.PRODUCT_REVIEW_SUBMITTED;
    case "review_helpful_voted":
      return NotificationType.PRODUCT_REVIEW_REPLIED;
    case "review_reported":
      return NotificationType.PRODUCT_REVIEW_REPORTED;
    case "review_moderated":
      return NotificationType.PRODUCT_REVIEW_MODERATED;
    case "review_replied":
      return NotificationType.PRODUCT_REVIEW_REPLIED;
    case "order_address_correction_required":
    case "order_address_updated":
      return NotificationType.ORDER_STATUS_UPDATED;
    case "password_reset":
      return NotificationType.PASSWORD_RESET;
    case "account_verification":
      return NotificationType.ACCOUNT_VERIFICATION;
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
  if (!env.sesSmtpHost || !env.sesSmtpUser || !env.sesSmtpPass || env.emailProvider !== "ses") {
    throw new Error("SES email transport is not configured");
  }

  const result = await sendEmail({
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
  
  if (!result.success) {
    throw result.error || new Error("Email delivery failed");
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
    event.name === "order_placed" ||
    event.name === "suborder_confirmed" ||
    event.name === "suborder_processing" ||
    event.name === "suborder_shipped" ||
    event.name === "suborder_delivery_failed" ||
    event.name === "suborder_retry_scheduled" ||
    event.name === "suborder_shipment_returned" ||
    event.name === "suborder_returned" ||
    event.name === "suborder_delivered" ||
    event.name === "suborder_cancelled" ||
    event.name === "cancellation_request_created" ||
    event.name === "cancellation_request_approved" ||
    event.name === "cancellation_request_rejected" ||
    event.name === "cancellation_request_expired" ||
    event.name === "payment_initiated" ||
    event.name === "payment_success" ||
    event.name === "payment_failed" ||
    event.name === "refund_processed" ||
    event.name === "refund_state_updated" ||
    event.name === "return_state_updated"
  );
}

async function shouldSendEmailForRecipient(input: {
  prismaClient: PrismaClient | Prisma.TransactionClient;
  recipient: ResolvedRecipient;
  event: NotificationEvent;
}) {
  if (!input.recipient.email) return false;

  // Brand email policy:
  // - Keep email for new order assignment only.
  // - Suppress brand emails for shipment/delivery/failure/cancellation/status lifecycle updates.
  if (input.recipient.audience === "BRAND_MEMBERS") {
    return input.event.name === "order_placed";
  }

  // Admin should always receive operational email updates for order/payment flows.
  if (input.recipient.audience === "ADMIN") {
    return true;
  }

  // Customer order/payment notifications are transactional; always allow email when channel is enabled.
  if (input.recipient.audience === "USER" && isOrderOrPaymentEvent(input.event)) {
    return true;
  }

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
          pushTokens: [],
          channels: channelsForAudience("USER"),
        });
      }
    }
  }

  if (audiences.has("ADMIN")) {
    const shouldSkipAdminAudience =
      (event.name === "suborder_delivered" || event.name === "suborder_cancelled") &&
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
          pushTokens: [],
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
            email: member.brand.contactEmail || member.user.email,
            whatsapp: member.brand.whatsappNumber,
            pushTokens: [],
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
            email: owner.brand?.contactEmail || owner.email,
            whatsapp: owner.brand?.whatsappNumber,
            pushTokens: [],
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

  const resolved = Array.from(deduped.values());
  const pushUserIds = Array.from(
    new Set(
      resolved
        .filter((recipient) => recipient.userId && recipient.channels.includes("PUSH"))
        .map((recipient) => recipient.userId!),
    ),
  );

  if (!pushUserIds.length) {
    return resolved;
  }

  const deviceTokens = await prismaClient.userDeviceToken.findMany({
    where: {
      userId: { in: pushUserIds },
      disabledAt: null,
    },
    select: { userId: true, token: true },
  });
  const tokensByUserId = new Map<string, string[]>();

  for (const deviceToken of deviceTokens) {
    const tokens = tokensByUserId.get(deviceToken.userId) || [];
    tokens.push(deviceToken.token);
    tokensByUserId.set(deviceToken.userId, tokens);
  }

  return resolved.map((recipient) => ({
    ...recipient,
    pushTokens: recipient.userId ? tokensByUserId.get(recipient.userId) || [] : [],
  }));
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
  const userId = input.userId;
  if (!userId) {
    throw new Error("Notification userId is required");
  }

  const isDuplicate = await isDuplicateNotification({
    prismaClient: input.prismaClient,
    type: input.type,
    title: input.title,
    message: input.message,
    userId,
    brandId: input.brandId,
    orderId: input.orderId,
  });

  if (isDuplicate) {
    return null;
  }

  const notification = input.userId
      ? await input.prismaClient.notification.create({
        data: {
          type: input.type,
          title: input.title,
          message: input.message,
          userId,
          brandId: input.brandId ?? null,
          orderId: input.orderId ?? null,
          targetPath: input.targetPath ?? null,
        },
      })
    : await input.prismaClient.notification.create({
        data: {
          type: input.type,
          title: input.title,
          message: input.message,
          userId,
          brandId: input.brandId ?? null,
          orderId: input.orderId ?? null,
          targetPath: input.targetPath ?? null,
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
  const pushLogs: Array<{ id: string; token: string }> = [];

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

  for (const token of Array.from(new Set(input.pushTokens || []))) {
    const pushLog = await input.prismaClient.notificationChannelLog.create({
      data: {
        notificationId: notification.id,
        channel: NotificationChannel.PUSH,
        status: NotificationDeliveryStatus.QUEUED,
        recipient: token,
      },
      select: { id: true },
    });
    pushLogs.push({ id: pushLog.id, token });
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

  for (const pushLog of pushLogs) {
    try {
      await withRetries(async () => {
        const result = await sendPushNotification({
          token: pushLog.token,
          title: input.title,
          message: input.message,
          data: input.pushData,
        });

        if (!result.ok) {
          const error = new Error(result.error || "Push delivery failed") as Error & { shouldDisableToken?: boolean };
          error.shouldDisableToken = result.shouldDisableToken;
          throw error;
        }
      });

      await input.prismaClient.notificationChannelLog.update({
        where: { id: pushLog.id },
        data: { status: NotificationDeliveryStatus.SENT, error: null },
      });
    } catch (error) {
      const deliveryError = error as Error & { shouldDisableToken?: boolean };
      await input.prismaClient.notificationChannelLog.update({
        where: { id: pushLog.id },
        data: {
          status: NotificationDeliveryStatus.FAILED,
          error: deliveryError.message.slice(0, 500) || "Push delivery failed",
        },
      });

      if (deliveryError.shouldDisableToken) {
        await input.prismaClient.userDeviceToken.updateMany({
          where: { token: pushLog.token },
          data: { disabledAt: new Date() },
        });
      }
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

    const targetPath = resolveNotificationTargetPath({
      type,
      orderId: event.orderId,
      subOrderId: "subOrderId" in event ? event.subOrderId : undefined,
      returnRequestId: "returnRequestId" in event ? event.returnRequestId : undefined,
      refundRequestId: "refundRequestId" in event ? event.refundRequestId : undefined,
      requestType: "requestType" in event ? event.requestType : undefined,
      title: template.title,
      message: template.message,
      role:
        recipient.audience === "ADMIN"
          ? "ADMIN"
          : recipient.audience === "BRAND_MEMBERS"
            ? "BRAND"
            : "USER",
      isBrandContext: recipient.audience === "BRAND_MEMBERS",
    });

    await createNotificationWithChannels({
      prismaClient,
      type,
      title: template.title,
      message: template.message,
      userId: recipient.userId,
      brandId: recipient.brandId,
      orderId: event.orderId,
      targetPath,
      emailRecipient: emailAllowed ? recipient.email : undefined,
      whatsappRecipient: recipient.channels.includes("WHATSAPP") ? recipient.whatsapp : undefined,
      emailSubject: `[Broady] ${template.title}`,
      emailText: template.message,
      pushTokens: recipient.channels.includes("PUSH") ? recipient.pushTokens : [],
      pushData: {
        eventName: event.name,
        orderId: event.orderId,
        brandId: event.brandId,
        userId: recipient.userId,
        targetPath,
      },
    });
  }
}

export function queueNotificationEvent(event: NotificationEvent) {
  // Execute immediately and directly without a background queue
  void emitNotificationEvent(event).catch((error) => {
    console.error("[notifications] failed to emit event", {
      event: event.name,
      orderId: event.orderId,
      brandId: event.brandId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
