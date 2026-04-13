import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { env } from "../../config/env.js";

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
      await sendEmailNotification({
        to: input.emailRecipient,
        subject: input.emailSubject || `[Broady] ${input.title}`,
        text: input.emailText || input.message,
        html: input.emailHtml,
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
      await sendWhatsappNotification({
        recipient: input.whatsappRecipient,
        title: input.title,
        message: input.message,
        payload: input.whatsappPayload,
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
