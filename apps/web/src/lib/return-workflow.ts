import type { ReturnRequestRecord, ReturnRequestStatus } from "@/types/marketplace";

type ReturnWorkflowState = {
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

export const RETURN_TIMELINE: ReturnRequestStatus[] = [
  "REQUESTED",
  "BRAND_REVIEWING",
  "NEED_MORE_EVIDENCE",
  "BRAND_APPROVED",
  "RETURN_ARRANGED",
  "RETURN_IN_TRANSIT",
  "RETURN_RECEIVED",
  "RETURN_CONDITION_APPROVED",
  "REFUND_INITIATED",
  "REFUND_PROCESSING",
  "REFUND_COMPLETED",
  "COMPLETED",
];

export const EXCHANGE_TIMELINE: ReturnRequestStatus[] = [
  "REQUESTED",
  "BRAND_REVIEWING",
  "NEED_MORE_EVIDENCE",
  "BRAND_APPROVED",
  "RETURN_ARRANGED",
  "RETURN_IN_TRANSIT",
  "RETURN_RECEIVED",
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
  "EXCHANGE_COMPLETED",
];

const RETURN_ADMIN_QUEUE_STATUSES: ReturnRequestStatus[] = [
  "NEED_MORE_EVIDENCE",
  "BRAND_REJECTED",
  "ADMIN_REVIEWING",
  "ADMIN_APPROVED",
  "ADMIN_REJECTED",
  "RETURN_CONDITION_DISPUTED",
  "RETURN_CONDITION_APPROVED",
  "REFUND_INITIATED",
  "REFUND_PROCESSING",
  "REFUND_COMPLETED",
  "COMPLETED",
];

const EXCHANGE_ADMIN_QUEUE_STATUSES: ReturnRequestStatus[] = [
  "NEED_MORE_EVIDENCE",
  "BRAND_REJECTED",
  "ADMIN_REVIEWING",
  "ADMIN_APPROVED",
  "ADMIN_REJECTED",
  "RETURN_CONDITION_DISPUTED",
  "RETURN_CONDITION_APPROVED",
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
  "EXCHANGE_COMPLETED",
];

export const REPLACEMENT_SHIPMENT_FLOW: ReturnRequestStatus[] = [
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
];

const RETURN_REASON_LABELS: Record<string, string> = {
  DAMAGED_ITEM: "Damaged item",
  DEFECTIVE_PRODUCT: "Defective product",
  WRONG_ITEM: "Wrong item received",
  WRONG_SIZE: "Wrong size",
  SIZE_ISSUE: "Size issue",
  WRONG_COLOR: "Wrong color",
  DIFFERENT_FROM_IMAGES: "Different from images shown",
  QUALITY_ISSUE: "Quality issue",
  CHANGED_MIND: "Changed my mind",
  OTHER: "Other",
};

export function getReturnRequestType(request?: Pick<ReturnWorkflowState, "requestType" | "preferredResolution"> | null) {
  if (request?.requestType === "RETURN" || request?.requestType === "EXCHANGE") {
    return request.requestType;
  }
  return request?.preferredResolution?.startsWith("EXCHANGE") ? "EXCHANGE" : "RETURN";
}

export function getExchangeResolutionForReason(reasonCode?: string | null) {
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

export function formatReturnReasonLabel(reasonCode?: string | null, reasonText?: string | null) {
  if (!reasonCode) {
    return reasonText?.trim() || "No reason provided";
  }
  if (reasonCode === "OTHER") {
    return reasonText?.trim() || RETURN_REASON_LABELS[reasonCode];
  }
  return RETURN_REASON_LABELS[reasonCode] || formatReturnStatus(reasonCode);
}

export function isExchangeRequest(request?: Pick<ReturnWorkflowState, "requestType" | "preferredResolution"> | null) {
  return getReturnRequestType(request) === "EXCHANGE";
}

export function isAvailabilityRejected(
  request?: Pick<ReturnWorkflowState, "requestType" | "preferredResolution" | "replacementUnavailable" | "status"> | null,
) {
  return isExchangeRequest(request) && Boolean(request?.replacementUnavailable) && request?.status === "BRAND_REJECTED";
}

export function getDisplayReturnStatus(
  request: ReturnWorkflowState,
) {
  if (request.status === "REVIEWING") {
    return request.brandRecommendation ? "ADMIN_REVIEWING" : "BRAND_REVIEWING";
  }
  if (request.status === "APPROVED") return "BRAND_APPROVED";
  if (request.status === "REJECTED") return request.adminDecision === "REJECTED" ? "ADMIN_REJECTED" : "BRAND_REJECTED";
  if (request.status === "PICKUP_SCHEDULED") return "RETURN_ARRANGED";
  if (request.status === "IN_TRANSIT") return "RETURN_IN_TRANSIT";
  if (request.status === "RECEIVED") {
    if (isExchangeRequest(request)) {
      if (request.replacementStatus === "REPLACEMENT_PACKED") return "REPLACEMENT_PACKED";
      if (request.replacementStatus === "REPLACEMENT_READY_FOR_PICKUP") return "REPLACEMENT_READY_FOR_PICKUP";
      if (request.replacementStatus === "REPLACEMENT_SHIPPED") return "REPLACEMENT_SHIPPED";
      if (request.replacementStatus === "REPLACEMENT_OUT_FOR_DELIVERY") return "REPLACEMENT_OUT_FOR_DELIVERY";
      if (request.replacementStatus === "REPLACEMENT_DELIVERY_FAILED") return "REPLACEMENT_DELIVERY_FAILED";
      if (request.replacementStatus === "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED") return "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED";
      if (request.replacementStatus === "REPLACEMENT_READY_FOR_REDELIVERY") return "REPLACEMENT_READY_FOR_REDELIVERY";
      if (request.replacementStatus === "REPLACEMENT_SHIPMENT_RETURNED") return "REPLACEMENT_SHIPMENT_RETURNED";
      if (request.replacementStatus === "REPLACEMENT_DELIVERED") return "REPLACEMENT_DELIVERED";
      if (request.replacementStatus === "EXCHANGE_COMPLETED") return "EXCHANGE_COMPLETED";
    }
    return "RETURN_RECEIVED";
  }
  if (request.status === "COMPLETED" && isExchangeRequest(request)) return "EXCHANGE_COMPLETED";
  return request.status;
}

export function formatReturnStatus(status?: string | null) {
  if (!status) return "Pending";
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatTimelineStatusForOperator(status?: string | null) {
  if (!status) return "Pending";
  if (status === "ADMIN_APPROVED") return "Admin Rejected";
  if (status === "ADMIN_REJECTED") return "Admin Approved";
  return formatReturnStatus(status);
}

export function formatOperatorReturnStatus(
  status?: string | null,
  requestType: "RETURN" | "EXCHANGE" = "RETURN",
) {
  if (!status) return "Pending";
  if (status === "REQUESTED") return requestType === "EXCHANGE" ? "Exchange Requested" : "Return Requested";
  if (status === "BRAND_REVIEWING" || status === "ADMIN_REVIEWING") return "Under Review";
  if (status === "BRAND_APPROVED" || status === "ADMIN_APPROVED") return requestType === "EXCHANGE" ? "Exchange Approved" : "Return Approved";
  if (status === "BRAND_REJECTED") return "Brand Rejected";
  if (status === "ADMIN_REJECTED") return "Admin Rejected";
  if (status === "RETURN_ARRANGED" || status === "RETURN_IN_TRANSIT") return "Awaiting Product Receipt";
  if (status === "RETURN_RECEIVED") return "Product Received";
  if (status === "RETURN_CONDITION_APPROVED") return "Condition Approved";
  if (status === "RETURN_CONDITION_DISPUTED") return "Condition Disputed";
  if (status === "REFUND_INITIATED") return "Refund Initiated";
  if (status === "REFUND_PROCESSING") return "Refund Under Review";
  if (status === "REFUND_COMPLETED" || status === "COMPLETED") return "Refund Completed";
  if (status === "REPLACEMENT_PROCESSING") return "Replacement Processing";
  if (status === "REPLACEMENT_PACKED") return "Replacement Packed";
  if (status === "REPLACEMENT_READY_FOR_PICKUP") return "Ready For Pickup";
  if (status === "REPLACEMENT_SHIPPED") return "Replacement Shipped";
  if (status === "REPLACEMENT_OUT_FOR_DELIVERY") return "Out For Delivery";
  if (status === "REPLACEMENT_DELIVERY_FAILED") return "Replacement Delivery Failed";
  if (status === "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED") return "Replacement Address Correction Required";
  if (status === "REPLACEMENT_READY_FOR_REDELIVERY") return "Replacement Ready For Re-Delivery";
  if (status === "REPLACEMENT_SHIPMENT_RETURNED") return "Replacement Shipment Returned";
  if (status === "REPLACEMENT_DELIVERED" || status === "EXCHANGE_COMPLETED") return "Replacement Delivered";
  return formatReturnStatus(status);
}

export function getNextReplacementStatuses(status?: string | null): Array<ReturnRequestStatus> {
  switch (status) {
    case "RETURN_RECEIVED":
    case "RETURN_CONDITION_APPROVED":
    case "ADMIN_APPROVED":
      return ["REPLACEMENT_PROCESSING"];
    case "REPLACEMENT_PROCESSING":
      return ["REPLACEMENT_PACKED"];
    case "REPLACEMENT_PACKED":
      return ["REPLACEMENT_READY_FOR_PICKUP"];
    case "REPLACEMENT_READY_FOR_PICKUP":
      return ["REPLACEMENT_SHIPPED"];
    case "REPLACEMENT_SHIPPED":
      return ["REPLACEMENT_OUT_FOR_DELIVERY"];
    case "REPLACEMENT_OUT_FOR_DELIVERY":
      return ["REPLACEMENT_DELIVERY_FAILED", "REPLACEMENT_DELIVERED"];
    case "REPLACEMENT_DELIVERY_FAILED":
      return ["REPLACEMENT_OUT_FOR_DELIVERY"];
    case "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED":
      return ["REPLACEMENT_READY_FOR_REDELIVERY"];
    case "REPLACEMENT_READY_FOR_REDELIVERY":
      return ["REPLACEMENT_OUT_FOR_DELIVERY", "REPLACEMENT_SHIPMENT_RETURNED"];
    default:
      return [];
  }
}

export function getReturnRequestItems(
  request?: {
    orderItemIds?: string[] | null;
    subOrder?: {
      items?: Array<{
        id: string;
        quantity: number;
        selectedColor?: string | null;
        selectedSize?: string | null;
        unitPricePkr?: number;
        product?: { id?: string; name?: string; imageUrl?: string };
      }>;
    } | null;
  } | null,
) {
  const items = request?.subOrder?.items || [];
  if (!request?.orderItemIds?.length) return items;
  return items.filter((item) => request.orderItemIds?.includes(item.id));
}

export function getReturnRequestItemIds(
  request?: {
    orderItemIds?: string[] | null;
  } | null,
  fallbackItemIds?: string[],
) {
  const itemIds = request?.orderItemIds?.length ? request.orderItemIds : fallbackItemIds || [];
  return Array.from(new Set(itemIds.filter(Boolean)));
}

export function getReturnRequestDetailPath(input: {
  role: "CUSTOMER" | "BRAND" | "ADMIN";
  orderId?: string | null;
  subOrderId?: string | null;
  requestId: string;
  requestType?: "RETURN" | "EXCHANGE" | null;
  preferredResolution?: string | null;
}) {
  const requestType = getReturnRequestType({
    requestType: input.requestType,
    preferredResolution: input.preferredResolution,
  });

  if (input.role === "BRAND") {
    return `/brand/operations/returns/${input.requestId}`;
  }

  if (input.role === "ADMIN") {
    return `/admin/operations/returns/${input.requestId}`;
  }

  const orderId = input.orderId || "";
  const subOrderId = input.subOrderId || "";
  return requestType === "EXCHANGE"
    ? `/account/orders/${orderId}/groups/${subOrderId}/exchange/${input.requestId}`
    : `/account/orders/${orderId}/groups/${subOrderId}/return/${input.requestId}`;
}

export function getAdminQueueStatusOptions(request: Pick<ReturnWorkflowState, "status" | "preferredResolution" | "requestType">) {
  const requestType = getReturnRequestType(request);
  const options =
    requestType === "EXCHANGE"
      ? EXCHANGE_ADMIN_QUEUE_STATUSES
      : RETURN_ADMIN_QUEUE_STATUSES;

  const currentStatus = request.status as ReturnRequestStatus | undefined;
  return Array.from(new Set<ReturnRequestStatus>(currentStatus ? [currentStatus, ...options] : options));
}

export function getWorkflowTimeline(request: ReturnRequestRecord) {
  const status = getDisplayReturnStatus(request);

  if (isAvailabilityRejected(request)) {
    return ["REQUESTED", "BRAND_REVIEWING", "BRAND_REJECTED"] as ReturnRequestStatus[];
  }
  if (status === "BRAND_REJECTED" || status === "ADMIN_REJECTED") {
    return ["REQUESTED", "BRAND_REVIEWING", "BRAND_REJECTED", "ADMIN_REVIEWING", "ADMIN_REJECTED"] as ReturnRequestStatus[];
  }
  if (status === "RETURN_CONDITION_DISPUTED") {
    return ["RETURN_RECEIVED", "RETURN_CONDITION_DISPUTED", "ADMIN_REVIEWING"] as ReturnRequestStatus[];
  }
  if (isExchangeRequest(request) && !request.convertedToRefund) {
    return EXCHANGE_TIMELINE;
  }
  return RETURN_TIMELINE;
}

export function isFinalReturnStatus(status?: string | null) {
  return status === "ADMIN_REJECTED" || status === "COMPLETED" || status === "EXCHANGE_COMPLETED";
}

export function getFinalRequestLabel(request: ReturnRequestRecord) {
  const requestType = getReturnRequestType(request);
  const status = getDisplayReturnStatus(request);

  if (isAvailabilityRejected(request)) return "Exchange rejected";
  if (status === "ADMIN_REJECTED") return requestType === "EXCHANGE" ? "Exchange rejected" : "Return rejected";
  if (status === "EXCHANGE_COMPLETED") return "Exchanged";
  if (status === "COMPLETED") return "Returned";
  return requestType === "EXCHANGE" ? "Exchange requested" : "Return requested";
}

export function getReturnStatusMessage(request: ReturnRequestRecord) {
  const status = getDisplayReturnStatus(request);
  const requestType = getReturnRequestType(request);

  switch (status) {
    case "REQUESTED":
      return "Your request has been submitted. Waiting for brand review.";
    case "BRAND_REVIEWING":
      return "Brand is reviewing your request.";
    case "NEED_MORE_EVIDENCE":
      return "Brand needs more evidence. Upload additional images or details.";
    case "BRAND_APPROVED":
      return "Brand approved your request. Return process will be arranged by the brand.";
    case "BRAND_REJECTED":
      return isAvailabilityRejected(request)
        ? "Brand cannot fulfill the requested replacement. Review the rejection details and contact support if you need help."
        : "Brand rejected your request. Broady admin is reviewing the case.";
    case "ADMIN_REVIEWING":
      return "Broady is reviewing the case.";
    case "ADMIN_APPROVED":
      return requestType === "EXCHANGE"
        ? "Broady approved the exchange. The brand will continue the replacement flow."
        : "Broady approved the return. The refund flow can continue.";
    case "ADMIN_REJECTED":
      return "Your request was rejected after review. Contact support if you need help.";
    case "RETURN_ARRANGED":
      return "Return has been arranged. Follow the courier or return instructions from the brand.";
    case "RETURN_IN_TRANSIT":
      return "Your original item is being returned.";
    case "RETURN_RECEIVED":
      return "Brand received your original item. Condition check is pending.";
    case "RETURN_CONDITION_APPROVED":
      return requestType === "EXCHANGE"
        ? "Return accepted. Replacement processing can continue."
        : "Return accepted. Refund will be processed.";
    case "RETURN_CONDITION_DISPUTED":
      return "Brand reported an issue with the returned item. Broady admin is reviewing the case.";
    case "REFUND_INITIATED":
      return "Refund has been initiated for your return.";
    case "REFUND_PROCESSING":
      return "Refund is processing.";
    case "REFUND_COMPLETED":
      return "Refund completed.";
    case "REPLACEMENT_PROCESSING":
      return "Replacement is being prepared.";
    case "REPLACEMENT_PACKED":
      return "Replacement is packed and being readied for dispatch.";
    case "REPLACEMENT_READY_FOR_PICKUP":
      return "Replacement is ready for courier pickup.";
    case "REPLACEMENT_SHIPPED":
      return "Replacement has been shipped.";
    case "REPLACEMENT_OUT_FOR_DELIVERY":
      return "Replacement is out for delivery.";
    case "REPLACEMENT_DELIVERY_FAILED":
      return "Replacement delivery failed. The brand will coordinate the next attempt.";
    case "REPLACEMENT_ADDRESS_CORRECTION_REQUIRED":
      return "Replacement delivery needs an address correction before it can be retried.";
    case "REPLACEMENT_READY_FOR_REDELIVERY":
      return "Replacement is ready for redelivery.";
    case "REPLACEMENT_SHIPMENT_RETURNED":
      return "Replacement shipment was returned after failed delivery attempts.";
    case "REPLACEMENT_DELIVERED":
      return "Replacement has been delivered.";
    case "EXCHANGE_COMPLETED":
      return "Exchange completed.";
    case "COMPLETED":
      return "Return completed.";
    default:
      return "Your request is being updated.";
  }
}
