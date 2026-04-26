export const notificationEventNames = {
  orderPlaced: "OrderPlaced",
  orderConfirmed: "OrderConfirmed",
  orderPacked: "OrderPacked",
  orderShipped: "OrderShipped",
  orderDelivered: "OrderDelivered",
  orderCancelled: "OrderCancelled",
  paymentInitiated: "PaymentInitiated",
  paymentSuccess: "PaymentSuccess",
  paymentFailed: "PaymentFailed",
  refundProcessed: "RefundProcessed",
  productSubmitted: "ProductSubmitted",
  productApproved: "ProductApproved",
  productRejected: "ProductRejected",
  brandApproved: "BrandApproved",
  reviewSubmitted: "ReviewSubmitted",
  reviewHelpfulVoted: "ReviewHelpfulVoted",
  reviewReported: "ReviewReported",
  reviewModerated: "ReviewModerated",
  reviewReplied: "ReviewReplied",
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
        | typeof notificationEventNames.orderPacked
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
