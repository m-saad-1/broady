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
  push: "PUSH",
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
  order_placed: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [
          notificationChannelPreference.dashboard,
          notificationChannelPreference.email,
          notificationChannelPreference.push,
          notificationChannelPreference.whatsapp,
        ],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  account_verification: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard],
      },
    ],
    priority: "HIGH",
  },
  suborder_confirmed: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  suborder_processing: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  suborder_shipped: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  suborder_delivery_failed: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  suborder_retry_scheduled: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  suborder_shipment_returned: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  suborder_returned: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  suborder_delivered: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  suborder_cancelled: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [
          notificationChannelPreference.dashboard,
          notificationChannelPreference.email,
          notificationChannelPreference.push,
          notificationChannelPreference.whatsapp,
        ],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  cancellation_request_created: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  cancellation_request_approved: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  cancellation_request_rejected: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  cancellation_request_expired: {
    audienceRules: [
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  payment_initiated: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  payment_success: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  payment_failed: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  refund_processed: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  refund_state_updated: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  return_state_updated: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  product_submitted: {
    audienceRules: [
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  product_approved: {
    audienceRules: [
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  product_rejected: {
    audienceRules: [
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  brand_approved: {
    audienceRules: [
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  review_submitted: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  review_helpful_voted: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.push],
      },
    ],
    priority: "LOW",
  },
  review_reported: {
    audienceRules: [
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  review_moderated: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  review_replied: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  order_address_correction_required: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.brandMembers,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  order_address_updated: {
    audienceRules: [
      {
        audience: notificationAudience.brandMembers,
        channels: [
          notificationChannelPreference.dashboard,
          notificationChannelPreference.email,
          notificationChannelPreference.push,
        ],
      },
      {
        audience: notificationAudience.admin,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email, notificationChannelPreference.push],
      },
    ],
    priority: "HIGH",
  },
  password_reset: {
    audienceRules: [
      {
        audience: notificationAudience.user,
        channels: [notificationChannelPreference.dashboard, notificationChannelPreference.email],
      },
    ],
    priority: "HIGH",
  },
};
