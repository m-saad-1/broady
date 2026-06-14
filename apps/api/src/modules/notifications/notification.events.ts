export const notificationEventNames = {
  accountVerification: "account_verification",
  orderPlaced: "order_placed",
  orderConfirmed: "suborder_confirmed",
  orderProcessing: "suborder_processing",
  orderShipped: "suborder_shipped",
  orderDeliveryFailed: "suborder_delivery_failed",
  orderRetryScheduled: "suborder_retry_scheduled",
  orderShipmentReturned: "suborder_shipment_returned",
  orderReturned: "suborder_returned",
  orderDelivered: "suborder_delivered",
  orderCancelled: "suborder_cancelled",
  cancellationRequestCreated: "cancellation_request_created",
  cancellationRequestApproved: "cancellation_request_approved",
  cancellationRequestRejected: "cancellation_request_rejected",
  cancellationRequestExpired: "cancellation_request_expired",
  paymentInitiated: "payment_initiated",
  paymentSuccess: "payment_success",
  paymentFailed: "payment_failed",
  refundProcessed: "refund_processed",
  refundStateUpdated: "refund_state_updated",
  returnStateUpdated: "return_state_updated",
  productSubmitted: "product_submitted",
  productApproved: "product_approved",
  productRejected: "product_rejected",
  brandApproved: "brand_approved",
  reviewSubmitted: "review_submitted",
  reviewHelpfulVoted: "review_helpful_voted",
  reviewReported: "review_reported",
  reviewModerated: "review_moderated",
  reviewReplied: "review_replied",
  orderAddressCorrectionRequired: "order_address_correction_required",
  orderAddressUpdated: "order_address_updated",
  passwordReset: "password_reset",
} as const;

export type NotificationEventName = (typeof notificationEventNames)[keyof typeof notificationEventNames];

type BaseEvent = {
  orderId?: string;
  brandId?: string;
  userId?: string;
};

export type NotificationEvent =
  | (BaseEvent & {
      name: typeof notificationEventNames.accountVerification;
      userId: string;
      verificationUrl: string;
    })
  | (BaseEvent & {
      name:
        | typeof notificationEventNames.orderPlaced
        | typeof notificationEventNames.orderConfirmed
        | typeof notificationEventNames.orderProcessing
        | typeof notificationEventNames.orderShipped
        | typeof notificationEventNames.orderDeliveryFailed
        | typeof notificationEventNames.orderRetryScheduled
        | typeof notificationEventNames.orderShipmentReturned
        | typeof notificationEventNames.orderReturned
        | typeof notificationEventNames.orderDelivered
        | typeof notificationEventNames.orderCancelled
        | typeof notificationEventNames.cancellationRequestCreated
        | typeof notificationEventNames.cancellationRequestApproved
        | typeof notificationEventNames.cancellationRequestRejected
        | typeof notificationEventNames.cancellationRequestExpired
        | typeof notificationEventNames.orderAddressCorrectionRequired
        | typeof notificationEventNames.orderAddressUpdated;
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
        | typeof notificationEventNames.refundProcessed
        | typeof notificationEventNames.refundStateUpdated;
      orderId: string;
      paymentMethod?: "COD" | "JAZZCASH" | "EASYPAISA";
      reason?: string;
    })
  | (BaseEvent & {
      name: typeof notificationEventNames.returnStateUpdated;
      orderId: string;
      subOrderId?: string;
      note?: string;
      brandName?: string;
      changedByRole?: "SYSTEM" | "ADMIN" | "BRAND" | "USER";
      notifyAdmin?: boolean;
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
    })
  | (BaseEvent & {
      name: typeof notificationEventNames.passwordReset;
      userId: string;
      resetUrl: string;
    })
