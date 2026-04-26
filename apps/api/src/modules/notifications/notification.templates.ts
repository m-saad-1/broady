import type { NotificationEvent } from "./notification.events.js";
import type { NotificationAudience } from "./notification.rules.js";

type TemplatePayload = {
  title: string;
  message: string;
};

type NotificationTemplateContext = {
  recipientBrandName?: string;
  orderBrandNames?: string[];
};

function orderTitle(name: NotificationEvent["name"]) {
  switch (name) {
    case "OrderPlaced":
      return "Order Placed";
    case "OrderConfirmed":
      return "Order Confirmed";
    case "OrderPacked":
      return "Order Packed";
    case "OrderShipped":
      return "Order Shipped";
    case "OrderDelivered":
      return "Order Delivered";
    case "OrderCancelled":
      return "Order Cancelled";
    default:
      return "Order Update";
  }
}

function appendNote(note?: string) {
  if (!note) return "";
  return ` ${note}`;
}

function resolveOrderBrandLabel(context?: NotificationTemplateContext) {
  const brands = (context?.orderBrandNames || []).filter(Boolean);
  if (!brands.length) return null;
  if (brands.length === 1) return brands[0];
  return `${brands[0]} + ${brands.length - 1} more`;
}

export function buildNotificationTemplate(
  event: NotificationEvent,
  audience: NotificationAudience,
  context?: NotificationTemplateContext,
): TemplatePayload {
  if (
    event.name === "OrderPlaced" ||
    event.name === "OrderConfirmed" ||
    event.name === "OrderPacked" ||
    event.name === "OrderShipped" ||
    event.name === "OrderDelivered" ||
    event.name === "OrderCancelled"
  ) {
    const normalizedOrderEventName =
      event.name === "OrderShipped" && event.note?.toLowerCase().includes("delivered") ? "OrderDelivered" : event.name;
    const noteSuffix = appendNote(event.note);
    const title = orderTitle(normalizedOrderEventName);
    const recipientBrand = context?.recipientBrandName || event.brandName || "your brand";
    const orderBrandLabel = resolveOrderBrandLabel(context);

    if (audience === "USER") {
      if (normalizedOrderEventName === "OrderPlaced") {
        return {
          title,
          message: `Your order ${event.orderId} has been placed successfully on Broady.`,
        };
      }

      if (normalizedOrderEventName === "OrderConfirmed") {
        return {
          title,
          message: `Order ${event.orderId} has been confirmed.`,
        };
      }

      if (normalizedOrderEventName === "OrderPacked") {
        return {
          title,
          message: `Order ${event.orderId} has been packed.`,
        };
      }

      if (normalizedOrderEventName === "OrderShipped") {
        const shippedByBrandName = context?.recipientBrandName || event.brandName || orderBrandLabel || "the brand";
        return {
          title,
          message: `Order ${event.orderId} has been shipped by ${shippedByBrandName}.`,
        };
      }

      if (normalizedOrderEventName === "OrderCancelled") {
        const cancelledRef = event.subOrderId ? `Sub-order ${event.subOrderId}` : `Your order ${event.orderId}`;
        return {
          title,
          message: `${cancelledRef} has been cancelled.${noteSuffix}`,
        };
      }

      if (normalizedOrderEventName === "OrderDelivered" && event.note?.toLowerCase().includes("fully delivered")) {
        return {
          title,
          message: `Your order ${event.orderId} has been fully delivered.`,
        };
      }

      if (normalizedOrderEventName === "OrderDelivered") {
        const deliveredBrandName = context?.recipientBrandName || event.brandName || orderBrandLabel || "brand";
        const deliveredRef = event.subOrderId ? `Sub-order ${event.subOrderId}` : `Order ${event.orderId}`;
        return {
          title,
          message: `${deliveredRef} has been delivered. Your ${deliveredBrandName} item has been delivered.`,
        };
      }
    }

    if (audience === "BRAND_MEMBERS") {
      if (normalizedOrderEventName === "OrderPlaced") {
        return {
          title,
          message: `New order ${event.orderId} received for ${recipientBrand}. Please review and confirm it.`,
        };
      }

      if (normalizedOrderEventName === "OrderConfirmed") {
        return {
          title,
          message: `Order ${event.orderId} has been confirmed.`,
        };
      }

      if (normalizedOrderEventName === "OrderPacked") {
        return {
          title,
          message: `Order ${event.orderId} has been packed.`,
        };
      }

      if (normalizedOrderEventName === "OrderShipped") {
        return {
          title,
          message: `Order ${event.orderId} has been shipped.`,
        };
      }

      if (normalizedOrderEventName === "OrderCancelled") {
        const cancelledRef = event.subOrderId ? `Sub-order ${event.subOrderId}` : `Order ${event.orderId}`;
        return {
          title,
          message: `${cancelledRef} for ${recipientBrand} has been cancelled.${noteSuffix}`,
        };
      }

      if (normalizedOrderEventName === "OrderDelivered") {
        const deliveredRef = event.subOrderId ? `Sub-order ${event.subOrderId}` : `Order ${event.orderId}`;
        return {
          title,
          message: `${deliveredRef} has been delivered.`,
        };
      }
    }

    if (normalizedOrderEventName === "OrderPlaced") {
      return {
        title,
        message: orderBrandLabel
          ? `New order ${event.orderId} placed for ${orderBrandLabel}.`
          : `New order ${event.orderId} has been placed in the marketplace.`,
      };
    }

    if (normalizedOrderEventName === "OrderConfirmed") {
      return {
        title,
        message: `Order ${event.orderId} has been confirmed.`,
      };
    }

    if (normalizedOrderEventName === "OrderPacked") {
      return {
        title,
        message: `Order ${event.orderId} has been packed.`,
      };
    }

    if (normalizedOrderEventName === "OrderShipped") {
      const shippedByBrandName = event.brandName || orderBrandLabel || "the brand";
      return {
        title,
        message: `Order ${event.orderId} has been shipped by ${shippedByBrandName}.`,
      };
    }

    if (normalizedOrderEventName === "OrderCancelled") {
      const cancelledRef = event.subOrderId ? `Sub-order ${event.subOrderId}` : `Order ${event.orderId}`;
      return {
        title,
        message: orderBrandLabel
          ? `${cancelledRef} for ${orderBrandLabel} has been cancelled.${noteSuffix}`
          : `${cancelledRef} has been cancelled.${noteSuffix}`,
      };
    }

    if (normalizedOrderEventName === "OrderDelivered") {
      const deliveredByBrandName = event.brandName || orderBrandLabel || "the brand";
      const deliveredRef = event.subOrderId ? `Sub-order ${event.subOrderId}` : `Order ${event.orderId}`;
      return {
        title,
        message: `${deliveredRef} has been delivered by ${deliveredByBrandName}.`,
      };
    }
  }

  if (event.name === "PaymentInitiated") {
    if (audience === "ADMIN") {
      return {
        title: "Payment Started",
        message: `Payment initiated for order ${event.orderId}${event.paymentMethod ? ` via ${event.paymentMethod}` : ""}.`,
      };
    }

    return {
      title: "Payment Started",
      message: `Your payment for order ${event.orderId} has started${event.paymentMethod ? ` via ${event.paymentMethod}` : ""}.`,
    };
  }

  if (event.name === "PaymentSuccess") {
    if (audience === "ADMIN") {
      return {
        title: "Payment Successful",
        message: `Payment completed for order ${event.orderId}.`,
      };
    }

    return {
      title: "Payment Successful",
      message: `Your payment for order ${event.orderId} has been completed.`,
    };
  }

  if (event.name === "PaymentFailed") {
    if (audience === "ADMIN") {
      return {
        title: "Payment Failed",
        message: `Payment failed for order ${event.orderId}${event.reason ? `. Reason: ${event.reason}` : ""}.`,
      };
    }

    return {
      title: "Payment Failed",
      message: `Your payment for order ${event.orderId} failed${event.reason ? `. Reason: ${event.reason}` : ""}.`,
    };
  }

  if (event.name === "RefundProcessed") {
    if (audience === "ADMIN") {
      return {
        title: "Refund Processed",
        message: `Refund processed for order ${event.orderId}.`,
      };
    }

    return {
      title: "Refund Processed",
      message: `Your refund for order ${event.orderId} has been processed.`,
    };
  }

  if (event.name === "ProductSubmitted") {
    const recipientBrand = context?.recipientBrandName || "a brand";
    return {
      title: "Product Added",
      message: `New product ${event.productId} was submitted by ${recipientBrand} and is awaiting approval.`,
    };
  }

  if (event.name === "ProductApproved") {
    return {
      title: "Product Approved by Broady",
      message: `Your product ${event.productId} has been approved and is now live.`,
    };
  }

  if (event.name === "ProductRejected") {
    return {
      title: "Product Rejected by Broady",
      message: `Your product ${event.productId} was rejected${event.note ? `. Reason: ${event.note}` : ""}.`,
    };
  }

  if (event.name === "BrandApproved") {
    return {
      title: "Brand Approved by Broady",
      message: `Your brand has been approved on Broady${event.note ? `. Note: ${event.note}` : ""}.`,
    };
  }

  if (event.name === "ReviewSubmitted") {
    if (audience === "USER") {
      return {
        title: "Review Submitted",
        message: `Thanks for your review on ${event.productName}.`,
      };
    }

    if (audience === "BRAND_MEMBERS") {
      return {
        title: "New Review Submitted",
        message: `A new customer review was posted for ${event.productName}.`,
      };
    }

    return {
      title: "Review Submitted",
      message: `New review submitted for ${event.productName}.`,
    };
  }

  if (event.name === "ReviewHelpfulVoted") {
    return {
      title: "Review Marked Helpful",
      message: `Someone marked your review for ${event.productName} as helpful.`,
    };
  }

  if (event.name === "ReviewReported") {
    return {
      title: "Review Reported",
      message: `A review for ${event.productName} was reported and needs moderation.`,
    };
  }

  if (event.name === "ReviewModerated") {
    return {
      title: "Review Moderated",
      message: `Your review for ${event.productName} is now ${event.moderationStatus.toLowerCase()}.`,
    };
  }

  if (event.name === "ReviewReplied") {
    const brandPrefix = event.brandName ? `${event.brandName} replied` : "A brand replied";
    return {
      title: "Brand Reply on Review",
      message: `${brandPrefix} to your review on ${event.productName}.`,
    };
  }

  return {
    title: "Broady Notification",
    message: "You have a new notification from Broady.",
  };
}
