type ReturnRequestLike = {
  status?: string | null;
  requestType?: string | null;
  preferredResolution?: string | null;
  brandRecommendation?: string | null;
  adminDecision?: string | null;
  replacementStatus?: string | null;
  convertedToRefund?: boolean | null;
  replacementUnavailable?: boolean | null;
  refundRequests?: Array<{ status?: string | null }> | null;
};

export const MODERN_RETURN_STATUSES = [
  "REQUESTED",
  "BRAND_REVIEWING",
  "NEED_MORE_EVIDENCE",
  "BRAND_APPROVED",
  "BRAND_REJECTED",
  "ADMIN_REVIEWING",
  "ADMIN_APPROVED",
  "ADMIN_REJECTED",
  "APPROVED",
  "REJECTED",
  "RETURN_ARRANGED",
  "PICKUP_SCHEDULED",
  "RETURN_IN_TRANSIT",
  "RETURN_RECEIVED",
  "RETURN_CONDITION_APPROVED",
  "RETURN_CONDITION_DISPUTED",
  "REFUND_INITIATED",
  "REFUND_PROCESSING",
  "REFUND_COMPLETED",
  "REPLACEMENT_PROCESSING",
  "REPLACEMENT_PACKED",
  "REPLACEMENT_READY_FOR_PICKUP",
  "REPLACEMENT_SHIPPED",
  "REPLACEMENT_OUT_FOR_DELIVERY",
  "REPLACEMENT_DELIVERY_FAILED",
  "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED",
  "REPLACEMENT_READY_FOR_REDELIVERY",
  "REPLACEMENT_SHIPMENT_RETURNED",
  "REPLACEMENT_DELIVERED",
  "COMPLETED",
  "EXCHANGE_COMPLETED",
] as const;

export const BRAND_RECOMMENDATION_ACTIONABLE_STATUSES = new Set([
  "REQUESTED",
  "BRAND_REVIEWING",
  "REVIEWING",
]);

export const BRAND_RECEIPT_ACTIONABLE_STATUSES = new Set([
  "RETURN_ARRANGED",
  "PICKUP_SCHEDULED",
  "RETURN_IN_TRANSIT",
  "IN_TRANSIT",
]);

export const FINAL_RETURN_STATUSES = new Set([
  "REJECTED",
  "ADMIN_REJECTED",
  "COMPLETED",
  "EXCHANGE_COMPLETED",
]);

export function isExchangeResolution(preferredResolution?: string | null) {
  return Boolean(preferredResolution?.startsWith("EXCHANGE"));
}

export function inferReturnRequestType(input: Pick<ReturnRequestLike, "requestType" | "preferredResolution">) {
  if (input.requestType === "RETURN" || input.requestType === "EXCHANGE") {
    return input.requestType;
  }
  return isExchangeResolution(input.preferredResolution) ? "EXCHANGE" : "RETURN";
}

export function getEffectiveReturnStatus(input: ReturnRequestLike) {
  const requestType = inferReturnRequestType(input);
  const status = input.status || "REQUESTED";

  if (status === "REVIEWING") {
    return input.brandRecommendation ? "ADMIN_REVIEWING" : "BRAND_REVIEWING";
  }

  if (status === "APPROVED") {
    return "BRAND_APPROVED";
  }

  if (status === "REJECTED") {
    return input.adminDecision === "REJECTED" ? "ADMIN_REJECTED" : "BRAND_REJECTED";
  }

  if (status === "PICKUP_SCHEDULED") {
    return "RETURN_ARRANGED";
  }

  if (status === "IN_TRANSIT") {
    return "RETURN_IN_TRANSIT";
  }

  if (status === "RETURN_RECEIVED" || status === "RETURN_CONDITION_APPROVED" || status === "RETURN_CONDITION_DISPUTED") {
    return status;
  }

  if (status === "RECEIVED") {
    if (requestType === "EXCHANGE") {
      if (input.replacementStatus === "REPLACEMENT_PACKED") {
        return "REPLACEMENT_PACKED";
      }
      if (input.replacementStatus === "REPLACEMENT_READY_FOR_PICKUP") {
        return "REPLACEMENT_READY_FOR_PICKUP";
      }
      if (input.convertedToRefund || input.replacementUnavailable) {
        return "REFUND_INITIATED";
      }
      if (input.replacementStatus === "REPLACEMENT_SHIPPED") {
        return "REPLACEMENT_SHIPPED";
      }
      if (input.replacementStatus === "REPLACEMENT_OUT_FOR_DELIVERY") {
        return "REPLACEMENT_OUT_FOR_DELIVERY";
      }
      if (input.replacementStatus === "REPLACEMENT_DELIVERY_FAILED") {
        return "REPLACEMENT_DELIVERY_FAILED";
      }
      if (input.replacementStatus === "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED") {
        return "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED";
      }
      if (input.replacementStatus === "REPLACEMENT_READY_FOR_REDELIVERY") {
        return "REPLACEMENT_READY_FOR_REDELIVERY";
      }
      if (input.replacementStatus === "REPLACEMENT_SHIPMENT_RETURNED") {
        return "REPLACEMENT_SHIPMENT_RETURNED";
      }
      if (input.replacementStatus === "REPLACEMENT_DELIVERED") {
        return "REPLACEMENT_DELIVERED";
      }
      if (input.replacementStatus === "EXCHANGE_COMPLETED") {
        return "EXCHANGE_COMPLETED";
      }
      return "REPLACEMENT_PROCESSING";
    }

    const latestRefundStatus = input.refundRequests?.[0]?.status || null;
    if (latestRefundStatus === "PROCESSING") return "REFUND_PROCESSING";
    if (latestRefundStatus === "COMPLETED") return "REFUND_COMPLETED";
    return "RETURN_RECEIVED";
  }

  if (status === "COMPLETED" && requestType === "EXCHANGE") {
    return "EXCHANGE_COMPLETED";
  }

  return status;
}

export function deriveExchangeType(preferredResolution?: string | null) {
  switch (preferredResolution) {
    case "EXCHANGE_SIZE":
      return "SIZE";
    case "EXCHANGE_COLOR":
      return "COLOR";
    case "EXCHANGE_DAMAGED_REPLACEMENT":
      return "DAMAGED_REPLACEMENT";
    case "EXCHANGE_WRONG_ITEM_REPLACEMENT":
      return "WRONG_ITEM_REPLACEMENT";
    case "EXCHANGE_OTHER":
      return "OTHER";
    default:
      return undefined;
  }
}

export function deriveExchangeResolutionForReason(reasonCode?: string | null) {
  switch (reasonCode) {
    case "WRONG_SIZE":
    case "SIZE_ISSUE":
      return "EXCHANGE_SIZE" as const;
    case "WRONG_COLOR":
      return "EXCHANGE_COLOR" as const;
    case "DAMAGED_ITEM":
    case "DEFECTIVE_PRODUCT":
      return "EXCHANGE_DAMAGED_REPLACEMENT" as const;
    case "WRONG_ITEM":
      return "EXCHANGE_WRONG_ITEM_REPLACEMENT" as const;
    default:
      return "EXCHANGE_OTHER" as const;
  }
}

export function normalizeReturnRequestForApi<T extends ReturnRequestLike>(input: T) {
  const requestType = inferReturnRequestType(input);
  const latestRefundStatus = input.refundRequests?.[0]?.status || null;

  return {
    ...input,
    requestType,
    status: getEffectiveReturnStatus(input),
    refundStatusSnapshot: latestRefundStatus,
  };
}

export function getPostReceiptStatuses(requestType: "RETURN" | "EXCHANGE") {
  return {
    receivedStatus: "RETURN_RECEIVED" as const,
    nextStatus: requestType === "EXCHANGE" ? ("REPLACEMENT_PROCESSING" as const) : ("REFUND_INITIATED" as const),
    replacementStatus: requestType === "EXCHANGE" ? ("REPLACEMENT_PROCESSING" as const) : null,
  };
}
