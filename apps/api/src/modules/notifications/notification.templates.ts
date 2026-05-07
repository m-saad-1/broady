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

/**
 * Masks an order ID for display (first 4 chars + ... + last 4 chars)
 * Example: cmosz2xwz001rh2787jfwsw5o -> cmosz...wswso
 */
function maskOrderId(orderId: string): string {
  if (!orderId || orderId.length <= 8) {
    return orderId;
  }
  const firstFour = orderId.substring(0, 4);
  const lastFour = orderId.substring(orderId.length - 4);
  return `${firstFour}...${lastFour}`;
}

function orderTitle(name: NotificationEvent["name"]) {
  switch (name) {
    case "order_placed":
      return "Order Placed";
    case "suborder_confirmed":
      return "Order Confirmed";
    case "suborder_processing":
      return "Order Processing";
    case "suborder_shipped":
      return "Order Shipped";
    case "suborder_delivery_failed":
      return "Delivery Failed";
    case "suborder_retry_scheduled":
      return "Retry Scheduled";
    case "suborder_returned":
      return "Order Returned";
    case "suborder_delivered":
      return "Order Delivered";
    case "suborder_cancelled":
      return "Order Cancelled";
    case "order_address_updated":
      return "Address Updated";
    default:
      return "Order Update";
  }
}

function resolveOrderUpdateTitle(event: NotificationEvent) {
  const note = "note" in event ? event.note?.toLowerCase() || "" : "";
  if (note.includes("out for delivery")) return "Out For Delivery";
  if (note.includes("delivery failed")) return "Delivery Failed";
  if (note.includes("returned")) return "Order Returned";
  if (note.includes("address updated")) return "Address Updated";
  return orderTitle(event.name);
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
    event.name === "order_placed" ||
    event.name === "suborder_confirmed" ||
    event.name === "suborder_processing" ||
    event.name === "suborder_shipped" ||
    event.name === "suborder_delivery_failed" ||
    event.name === "suborder_retry_scheduled" ||
    event.name === "suborder_returned" ||
    event.name === "suborder_delivered" ||
    event.name === "suborder_cancelled" ||
    event.name === "order_address_correction_required"
  ) {
    const normalizedOrderEventName =
      event.name === "suborder_shipped" && event.note?.toLowerCase().includes("delivered") ? "suborder_delivered" : event.name;
    const noteSuffix = appendNote(event.note);
    const title = resolveOrderUpdateTitle({ ...event, name: normalizedOrderEventName } as NotificationEvent);
    const recipientBrand = context?.recipientBrandName || event.brandName || "your brand";
    const orderBrandLabel = resolveOrderBrandLabel(context);

    if (audience === "USER") {
      if (normalizedOrderEventName === "order_placed") {
        return {
          title,
          message: `Your order ${maskOrderId(event.orderId)} has been placed successfully on Broady.`,
        };
      }

      if (normalizedOrderEventName === "suborder_confirmed") {
        return {
          title,
          message: `Order ${maskOrderId(event.orderId)} has been confirmed.`,
        };
      }

      if (normalizedOrderEventName === "suborder_processing") {
        return {
          title,
          message: `Order ${maskOrderId(event.orderId)} is being processed.`,
        };
      }

      if (normalizedOrderEventName === "suborder_shipped") {
        const shippedByBrandName = context?.recipientBrandName || event.brandName || orderBrandLabel || "the brand";
        return {
          title,
          message: noteSuffix.trim() || `Order ${maskOrderId(event.orderId)} has been shipped by ${shippedByBrandName}.`,
        };
      }

      if (normalizedOrderEventName === "order_address_correction_required") {
        return {
          title: "Address Correction Required",
          message: `Your delivery failed due to incorrect address. Please update your address to proceed with delivery.`,
        };
      }

      if (normalizedOrderEventName === "suborder_delivery_failed") {
        const failureNote = event.note ? `\n${event.note}` : "";
        return {
          title,
          message: `Delivery unsuccessful for order ${maskOrderId(event.orderId)}.${failureNote}${failureNote ? "" : " We're working on your delivery."}`,
        };
      }

      if (normalizedOrderEventName === "suborder_retry_scheduled") {
        return {
          title,
          message: event.note ? `A delivery retry has been scheduled. ${event.note}` : `A delivery retry has been scheduled for order ${maskOrderId(event.orderId)}.`,
        };
      }

      if (normalizedOrderEventName === "suborder_returned") {
        const returnNote = event.note || "Your order has been processed for return.";
        return {
          title,
          message: `Order ${maskOrderId(event.orderId)} status: Returned. ${returnNote}`,
        };
      }

      if (normalizedOrderEventName === "suborder_cancelled") {
        const cancelledRef = event.subOrderId ? `Sub-order ${maskOrderId(event.subOrderId)}` : `Your order ${maskOrderId(event.orderId)}`;
        return {
          title,
          message: `${cancelledRef} has been cancelled.${noteSuffix}`,
        };
      }

      if (normalizedOrderEventName === "suborder_delivered" && event.note?.toLowerCase().includes("fully delivered")) {
        return {
          title,
          message: `Your order ${maskOrderId(event.orderId)} has been fully delivered.`,
        };
      }

      if (normalizedOrderEventName === "suborder_delivered") {
        const deliveredBrandName = context?.recipientBrandName || event.brandName || orderBrandLabel || "brand";
        const deliveredRef = event.subOrderId ? `Sub-order ${maskOrderId(event.subOrderId)}` : `Order ${maskOrderId(event.orderId)}`;
        return {
          title,
          message: `${deliveredRef} has been delivered. Your ${deliveredBrandName} item has been delivered.`,
        };
      }
    }

    if (audience === "BRAND_MEMBERS") {
      if (normalizedOrderEventName === "order_placed") {
        return {
          title,
          message: `New order ${maskOrderId(event.orderId)} received for ${recipientBrand}. Confirmation is handled by Broady automatically.`,
        };
      }

      if (normalizedOrderEventName === "suborder_confirmed") {
        return {
          title,
          message: `Order ${maskOrderId(event.orderId)} has been confirmed.`,
        };
      }

      if (normalizedOrderEventName === "suborder_processing") {
        return {
          title,
          message: `Order ${maskOrderId(event.orderId)} is being processed.`,
        };
      }

      if (normalizedOrderEventName === "suborder_shipped") {
        return {
          title,
          message: noteSuffix.trim() || `Order ${maskOrderId(event.orderId)} has been shipped.`,
        };
      }

      if (normalizedOrderEventName === "order_address_correction_required") {
        return {
          title: "Address Correction Required",
          message: `Order delivery failed due to incorrect address. Waiting for customer update.`,
        };
      }

      if (normalizedOrderEventName === "suborder_delivery_failed") {
        const failureNote = event.note ? `\n${event.note}` : "";
        return {
          title,
          message: `You updated the status for order ${maskOrderId(event.orderId)} to Delivery Failed.${failureNote}`,
        };
      }

      if (normalizedOrderEventName === "suborder_retry_scheduled") {
        return {
          title,
          message: event.note || `Retry scheduled for order ${maskOrderId(event.orderId)}.`,
        };
      }

      if (normalizedOrderEventName === "suborder_returned") {
        const returnNote = event.note || "Order has been processed for return.";
        return {
          title,
          message: `Order ${maskOrderId(event.orderId)} returned for ${recipientBrand}. ${returnNote}`,
        };
      }

      if (normalizedOrderEventName === "suborder_cancelled") {
        const cancelledRef = event.subOrderId ? `Sub-order ${maskOrderId(event.subOrderId)}` : `Order ${maskOrderId(event.orderId)}`;
        return {
          title,
          message: `${cancelledRef} for ${recipientBrand} has been cancelled.${noteSuffix}`,
        };
      }

      if (normalizedOrderEventName === "suborder_delivered") {
        const deliveredRef = event.subOrderId ? `Sub-order ${maskOrderId(event.subOrderId)}` : `Order ${maskOrderId(event.orderId)}`;
        return {
          title,
          message: `${deliveredRef} has been delivered.`,
        };
      }
    }

    if (normalizedOrderEventName === "order_placed") {
      return {
        title,
        message: orderBrandLabel
          ? `New order ${maskOrderId(event.orderId)} placed for ${orderBrandLabel}.`
          : `New order ${maskOrderId(event.orderId)} has been placed in the marketplace.`,
      };
    }

    if (normalizedOrderEventName === "suborder_confirmed") {
      return {
        title,
        message: `Order ${maskOrderId(event.orderId)} has been confirmed.`,
      };
    }

    if (normalizedOrderEventName === "suborder_processing") {
      return {
        title,
        message: `Order ${maskOrderId(event.orderId)} is being processed.`,
      };
    }

    if (normalizedOrderEventName === "suborder_shipped") {
      const shippedByBrandName = event.brandName || orderBrandLabel || "the brand";
      return {
        title,
        message: noteSuffix.trim() || `Order ${maskOrderId(event.orderId)} has been shipped by ${shippedByBrandName}.`,
      };
    }

    if (normalizedOrderEventName === "order_address_correction_required") {
      return {
        title: "Address Correction Required",
        message: `Delivery failed due to incorrect address. Please update your address to proceed with delivery.${noteSuffix}`,
      };
    }

    if (normalizedOrderEventName === "suborder_delivery_failed") {
      return {
        title,
        message: `Delivery failed for ${event.subOrderId ? `sub-order ${maskOrderId(event.subOrderId)}` : `order ${maskOrderId(event.orderId)}`}.${noteSuffix}`,
      };
    }

    if (normalizedOrderEventName === "suborder_retry_scheduled") {
      return {
        title,
        message: event.note || `Retry scheduled for order ${maskOrderId(event.orderId)}.`,
      };
    }

    if (normalizedOrderEventName === "suborder_returned") {
      return {
        title,
        message: `${event.subOrderId ? `Sub-order ${maskOrderId(event.subOrderId)}` : `Order ${maskOrderId(event.orderId)}`} has been returned.${noteSuffix}`,
      };
    }

    if (normalizedOrderEventName === "suborder_cancelled") {
      const cancelledRef = event.subOrderId ? `Sub-order ${maskOrderId(event.subOrderId)}` : `Order ${maskOrderId(event.orderId)}`;
      return {
        title,
        message: orderBrandLabel
          ? `${cancelledRef} for ${orderBrandLabel} has been cancelled.${noteSuffix}`
          : `${cancelledRef} has been cancelled.${noteSuffix}`,
      };
    }

    if (normalizedOrderEventName === "suborder_delivered") {
      const deliveredByBrandName = event.brandName || orderBrandLabel || "the brand";
      const deliveredRef = event.subOrderId ? `Sub-order ${maskOrderId(event.subOrderId)}` : `Order ${maskOrderId(event.orderId)}`;
      return {
        title,
        message: `${deliveredRef} has been delivered by ${deliveredByBrandName}.`,
      };
    }
  }

  if (event.name === "payment_initiated") {
    if (audience === "ADMIN") {
      return {
        title: "Payment Started",
        message: `Payment initiated for order ${maskOrderId(event.orderId)}${event.paymentMethod ? ` via ${event.paymentMethod}` : ""}.`,
      };
    }

    return {
      title: "Payment Started",
      message: `Your payment for order ${maskOrderId(event.orderId)} has started${event.paymentMethod ? ` via ${event.paymentMethod}` : ""}.`,
    };
  }

  if (event.name === "payment_success") {
    if (audience === "ADMIN") {
      return {
        title: "Payment Successful",
        message: `Payment completed for order ${maskOrderId(event.orderId)}.`,
      };
    }

    return {
      title: "Payment Successful",
      message: `Your payment for order ${maskOrderId(event.orderId)} has been completed.`,
    };
  }

  if (event.name === "payment_failed") {
    if (audience === "ADMIN") {
      return {
        title: "Payment Failed",
        message: `Payment failed for order ${maskOrderId(event.orderId)}${event.reason ? `. Reason: ${event.reason}` : ""}.`,
      };
    }

    return {
      title: "Payment Failed",
      message: `Your payment for order ${maskOrderId(event.orderId)} failed${event.reason ? `. Reason: ${event.reason}` : ""}.`,
    };
  }

  if (event.name === "refund_processed") {
    if (audience === "ADMIN") {
      return {
        title: "Refund Processed",
        message: `Refund processed for order ${maskOrderId(event.orderId)}.`,
      };
    }

    return {
      title: "Refund Processed",
      message: `Your refund for order ${maskOrderId(event.orderId)} has been processed.`,
    };
  }

  if (event.name === "product_submitted") {
    const recipientBrand = context?.recipientBrandName || "a brand";
    return {
      title: "Product Added",
      message: `New product ${event.productId} was submitted by ${recipientBrand} and is awaiting approval.`,
    };
  }

  if (event.name === "product_approved") {
    return {
      title: "Product Approved by Broady",
      message: `Your product ${event.productId} has been approved and is now live.`,
    };
  }

  if (event.name === "product_rejected") {
    return {
      title: "Product Rejected by Broady",
      message: `Your product ${event.productId} was rejected${event.note ? `. Reason: ${event.note}` : ""}.`,
    };
  }

  if (event.name === "brand_approved") {
    return {
      title: "Brand Approved by Broady",
      message: `Your brand has been approved on Broady${event.note ? `. Note: ${event.note}` : ""}.`,
    };
  }

  if (event.name === "review_submitted") {
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

  if (event.name === "review_helpful_voted") {
    return {
      title: "Review Marked Helpful",
      message: `Someone marked your review for ${event.productName} as helpful.`,
    };
  }

  if (event.name === "review_reported") {
    return {
      title: "Review Reported",
      message: `A review for ${event.productName} was reported and needs moderation.`,
    };
  }

  if (event.name === "review_moderated") {
    return {
      title: "Review Moderated",
      message: `Your review for ${event.productName} is now ${event.moderationStatus.toLowerCase()}.`,
    };
  }

  if (event.name === "review_replied") {
    const brandPrefix = event.brandName ? `${event.brandName} replied` : "A brand replied";
    return {
      title: "Brand Reply on Review",
      message: `${brandPrefix} to your review on ${event.productName}.`,
    };
  }

  if (event.name === "order_address_updated") {
    return {
      title: "Address Updated",
      message: event.note || `Customer has updated the delivery address for order ${event.orderId}.`,
    };
  }

  return {
    title: "Broady Notification",
    message: "You have a new notification from Broady.",
  };
}
