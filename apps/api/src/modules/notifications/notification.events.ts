export const notificationEventNames = {
  orderPlaced: "order_placed",
  orderConfirmed: "suborder_confirmed",
  orderProcessing: "suborder_processing",
  orderShipped: "suborder_shipped",
  orderDelivered: "suborder_delivered",
  orderCancelled: "suborder_cancelled",
  paymentInitiated: "payment_initiated",
  paymentSuccess: "payment_success",
  paymentFailed: "payment_failed",
  refundProcessed: "refund_processed",
  productSubmitted: "product_submitted",
  productApproved: "product_approved",
  productRejected: "product_rejected",
  brandApproved: "brand_approved",
  reviewSubmitted: "review_submitted",
  reviewHelpfulVoted: "review_helpful_voted",
  reviewReported: "review_reported",
  reviewModerated: "review_moderated",
  reviewReplied: "review_replied",
} as const;

export type NotificationEventName = (typeof notificationEventNames)[keyof typeof notificationEventNames];

type BaseEvent = {
  orderId?: string;
  brandId?: string;
  userId?: string;
};

export type NotificationEvent =
  | (BaseEvent & {
      name:
        | typeof notificationEventNames.orderPlaced
        | typeof notificationEventNames.orderConfirmed
        | typeof notificationEventNames.orderProcessing
        | typeof notificationEventNames.orderShipped
        | typeof notificationEventNames.orderDelivered
        | typeof notificationEventNames.orderCancelled;
      orderId: string;
      subOrderId?: string;
      changedByRole?: "SYSTEM" | "ADMIN" | "BRAND" | "USER";
      note?: string;
      brandName?: string;
      notifyAdmin?: boolean;
    })
  | (BaseEvent & {
      name:
        | typeof notificationEventNames.paymentInitiated
        | typeof notificationEventNames.paymentSuccess
        | typeof notificationEventNames.paymentFailed
        | typeof notificationEventNames.refundProcessed;
      orderId: string;
      paymentMethod?: "COD" | "JAZZCASH" | "EASYPAISA";
      reason?: string;
    })
  | (BaseEvent & {
      name: typeof notificationEventNames.productSubmitted;
      productId: string;
      brandId: string;
      submittedByUserId: string;
    })
  | (BaseEvent & {
      name: typeof notificationEventNames.productApproved | typeof notificationEventNames.productRejected;
      productId: string;
      brandId: string;
      note?: string;
    })
  | (BaseEvent & {
      name: typeof notificationEventNames.brandApproved;
      brandId: string;
      note?: string;
    })
  | (BaseEvent & {
      name: typeof notificationEventNames.reviewSubmitted;
      reviewId: string;
      orderId: string;
      userId: string;
      brandId: string;
      productId: string;
      productName: string;
      brandName?: string;
    })
  | (BaseEvent & {
      name: typeof notificationEventNames.reviewHelpfulVoted;
      reviewId: string;
      userId: string;
      productId: string;
      productName: string;
    })
  | (BaseEvent & {
      name: typeof notificationEventNames.reviewReported;
      reviewId: string;
      productId: string;
      productName: string;
      brandId: string;
    })
  | (BaseEvent & {
      name: typeof notificationEventNames.reviewModerated;
      reviewId: string;
      userId: string;
      productId: string;
      productName: string;
      moderationStatus: "VISIBLE" | "HIDDEN" | "FLAGGED" | "REMOVED";
    })
  | (BaseEvent & {
      name: typeof notificationEventNames.reviewReplied;
      reviewId: string;
      userId: string;
      productId: string;
      productName: string;
      brandId: string;
      brandName?: string;
    });
