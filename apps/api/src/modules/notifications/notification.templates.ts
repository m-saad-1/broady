import type { NotificationEvent } from "./notification.events.js";
import type { NotificationAudience } from "./notification.rules.js";

type TemplatePayload = {
  title: string;
  message: string;
};

function orderLabel(name: NotificationEvent["name"]) {
  switch (name) {
    case "OrderPlaced":
      return "placed";
    case "OrderConfirmed":
      return "confirmed";
    case "OrderPacked":
      return "packed";
    case "OrderShipped":
      return "shipped";
    case "OrderDelivered":
      return "delivered";
    case "OrderCancelled":
      return "canceled";
    default:
      return "updated";
  }
}

export function buildNotificationTemplate(event: NotificationEvent, audience: NotificationAudience): TemplatePayload {
  if (
    event.name === "OrderPlaced" ||
    event.name === "OrderConfirmed" ||
    event.name === "OrderPacked" ||
    event.name === "OrderShipped" ||
    event.name === "OrderDelivered" ||
    event.name === "OrderCancelled"
  ) {
    const status = orderLabel(event.name);
    const noteSuffix = event.note ? ` ${event.note}` : "";

    if (audience === "USER") {
      return {
        title: event.name === "OrderPlaced" ? "Order Confirmed" : "Order Update",
        message: `Your order ${event.orderId} has been ${status} on Broady.${noteSuffix}`,
      };
    }

    if (audience === "BRAND_MEMBERS") {
      return {
        title: "Order Workflow Update",
        message: `Order ${event.orderId} has been ${status} on Broady.${noteSuffix}`,
      };
    }

    return {
      title: "Order Event Observed",
      message: `Order ${event.orderId} has been ${status} on Broady.${noteSuffix}`,
    };
  }

  if (event.name === "PaymentInitiated") {
    return {
      title: "Payment Started",
      message: `Payment has been initiated for order ${event.orderId} on Broady${event.paymentMethod ? ` via ${event.paymentMethod}` : ""}.`,
    };
  }

  if (event.name === "PaymentSuccess") {
    return {
      title: "Payment Successful",
      message: `Payment has been completed for order ${event.orderId} on Broady.`,
    };
  }

  if (event.name === "PaymentFailed") {
    return {
      title: "Payment Failed",
      message: `Payment failed for order ${event.orderId} on Broady${event.reason ? `. Reason: ${event.reason}` : ""}.`,
    };
  }

  if (event.name === "RefundProcessed") {
    return {
      title: "Refund Processed",
      message: `Refund has been processed for order ${event.orderId} on Broady.`,
    };
  }

  if (event.name === "ProductSubmitted") {
    return {
      title: "Product Submission Requires Review",
      message: `A brand submitted product ${event.productId} for Broady approval.`,
    };
  }

  if (event.name === "ProductApproved") {
    return {
      title: "Product Approved by Broady",
      message: `Product ${event.productId} has been approved on Broady.`,
    };
  }

  if (event.name === "ProductRejected") {
    return {
      title: "Product Rejected by Broady",
      message: `Product ${event.productId} has been rejected on Broady${event.note ? `. Reason: ${event.note}` : ""}.`,
    };
  }

  if (event.name === "BrandApproved") {
    return {
      title: "Brand Approved by Broady",
      message: `Your brand has been approved on Broady${event.note ? `. Note: ${event.note}` : ""}.`,
    };
  }

  return {
    title: "Broady Notification",
    message: "You have a new notification from Broady.",
  };
}
