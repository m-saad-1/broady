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

export type NotificationEventRule = {
  audiences: NotificationAudience[];
  channels: NotificationChannelPreference[];
  priority: "HIGH" | "LOW";
};

export const notificationRules: Record<NotificationEventName, NotificationEventRule> = {
  OrderPlaced: {
    audiences: [notificationAudience.user, notificationAudience.admin, notificationAudience.brandMembers],
    channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
    priority: "HIGH",
  },
  OrderConfirmed: {
    audiences: [notificationAudience.user, notificationAudience.admin, notificationAudience.brandMembers],
    channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
    priority: "HIGH",
  },
  OrderPacked: {
    audiences: [notificationAudience.user, notificationAudience.admin, notificationAudience.brandMembers],
    channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
    priority: "HIGH",
  },
  OrderShipped: {
    audiences: [notificationAudience.user, notificationAudience.admin, notificationAudience.brandMembers],
    channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
    priority: "HIGH",
  },
  OrderDelivered: {
    audiences: [notificationAudience.user, notificationAudience.admin, notificationAudience.brandMembers],
    channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
    priority: "HIGH",
  },
  OrderCancelled: {
    audiences: [notificationAudience.user, notificationAudience.admin, notificationAudience.brandMembers],
    channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
    priority: "HIGH",
  },
  PaymentInitiated: {
    audiences: [notificationAudience.user, notificationAudience.admin],
    channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
    priority: "HIGH",
  },
  PaymentSuccess: {
    audiences: [notificationAudience.user, notificationAudience.admin],
    channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
    priority: "HIGH",
  },
  PaymentFailed: {
    audiences: [notificationAudience.user, notificationAudience.admin],
    channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
    priority: "HIGH",
  },
  RefundProcessed: {
    audiences: [notificationAudience.user, notificationAudience.admin],
    channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
    priority: "HIGH",
  },
  ProductSubmitted: {
    audiences: [notificationAudience.admin],
    channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
    priority: "HIGH",
  },
  ProductApproved: {
    audiences: [notificationAudience.brandMembers],
    channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
    priority: "HIGH",
  },
  ProductRejected: {
    audiences: [notificationAudience.brandMembers],
    channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
    priority: "HIGH",
  },
  BrandApproved: {
    audiences: [notificationAudience.brandMembers],
    channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
    priority: "HIGH",
  },
};
