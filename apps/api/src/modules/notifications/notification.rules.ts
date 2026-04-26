import type { NotificationEventName } from "./notification.events.js";

export const notificationAudience = {
  user: "USER",
  admin: "ADMIN",
  brandMembers: "BRAND_MEMBERS",
} as const;

export type NotificationAudience = (typeof notificationAudience)[keyof typeof notificationAudience];

export const notificationChannelPreference = {
  dashboard: "DASHBOARD",
  email: "EMAIL",
  whatsapp: "WHATSAPP",
} as const;

export type NotificationChannelPreference =
  (typeof notificationChannelPreference)[keyof typeof notificationChannelPreference];

export type NotificationAudienceRule = {
  audience: NotificationAudience;
  channels: NotificationChannelPreference[];
};

export type NotificationEventRule = {
  audienceRules: NotificationAudienceRule[];
  priority: "HIGH" | "LOW";
};

export const notificationRules: Record<NotificationEventName, NotificationEventRule> = {
  OrderPlaced: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.whatsapp],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
    ],
    priority: "HIGH",
  },
  OrderConfirmed: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
    ],
    priority: "HIGH",
  },
  OrderPacked: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
    ],
    priority: "HIGH",
  },
  OrderShipped: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
    ],
    priority: "HIGH",
  },
  OrderDelivered: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
    ],
    priority: "HIGH",
  },
  OrderCancelled: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.whatsapp],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
    ],
    priority: "HIGH",
  },
  PaymentInitiated: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
    ],
    priority: "HIGH",
  },
  PaymentSuccess: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
    ],
    priority: "HIGH",
  },
  PaymentFailed: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
    ],
    priority: "HIGH",
  },
  RefundProcessed: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
    ],
    priority: "HIGH",
  },
  ProductSubmitted: {
    audienceRules: [
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
    ],
    priority: "HIGH",
  },
  ProductApproved: {
    audienceRules: [
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
    ],
    priority: "HIGH",
  },
  ProductRejected: {
    audienceRules: [
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
    ],
    priority: "HIGH",
  },
  BrandApproved: {
    audienceRules: [
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
    ],
    priority: "HIGH",
  },
  ReviewSubmitted: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard],
      },
    ],
    priority: "HIGH",
  },
  ReviewHelpfulVoted: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard],
      },
    ],
    priority: "LOW",
  },
  ReviewReported: {
    audienceRules: [
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard],
      },
    ],
    priority: "HIGH",
  },
  ReviewModerated: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
    ],
    priority: "HIGH",
  },
  ReviewReplied: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
    ],
    priority: "HIGH",
  },
};
