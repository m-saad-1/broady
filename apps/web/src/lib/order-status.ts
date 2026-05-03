import type { OrderStatus } from "@/types/marketplace";

export const customerOrderStatusOptions: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERY_FAILED",
  "ADDRESS_CORRECTION_REQUIRED",
  "READY_FOR_REDELIVERY",
  "DELIVERED",
  "RETURNED",
  "CANCELED",
];

export function getOrderStatusOptions(currentStatus: OrderStatus) {
  switch (currentStatus) {
    case "PENDING":
      return [] satisfies OrderStatus[];
    case "CONFIRMED":
      return ["PROCESSING"] satisfies OrderStatus[];
    case "PROCESSING":
      return ["SHIPPED"] satisfies OrderStatus[];
    case "SHIPPED":
      return ["OUT_FOR_DELIVERY"] satisfies OrderStatus[];
    case "OUT_FOR_DELIVERY":
      return ["DELIVERY_FAILED", "DELIVERED"] satisfies OrderStatus[];
    case "DELIVERY_FAILED":
      return ["OUT_FOR_DELIVERY", "ADDRESS_CORRECTION_REQUIRED"] satisfies OrderStatus[];
    case "ADDRESS_CORRECTION_REQUIRED":
      return ["READY_FOR_REDELIVERY"] satisfies OrderStatus[];
    case "READY_FOR_REDELIVERY":
      return ["OUT_FOR_DELIVERY"] satisfies OrderStatus[];
    default:
      return [] satisfies OrderStatus[];
  }
}

export function getOrderStatusLabel(status: OrderStatus) {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "CONFIRMED":
      return "Confirmed";
    case "PROCESSING":
      return "Processing";
    case "PACKED":
      return "Processing";
    case "PARTIALLY_SHIPPED":
      return "Partially Delivered / In Progress";
    case "SHIPPED":
      return "Shipped";
    case "OUT_FOR_DELIVERY":
      return "Out for Delivery";
    case "DELIVERY_FAILED":
      return "Delivery Failed";
    case "ADDRESS_CORRECTION_REQUIRED":
      return "Address Correction Required";
    case "READY_FOR_REDELIVERY":
      return "Ready for Re-delivery";
    case "DELIVERED":
      return "Delivered";
    case "RETURNED":
      return "Returned";
    case "CANCELED":
      return "Cancelled";
    default:
      return status;
  }
}

export function getOrderStatusTone(status: OrderStatus) {
  switch (status) {
    case "PENDING":
      return "border-amber-300 bg-amber-50 text-amber-700";
    case "CONFIRMED":
      return "border-sky-300 bg-sky-50 text-sky-700";
    case "PROCESSING":
      return "border-indigo-300 bg-indigo-50 text-indigo-700";
    case "PACKED":
      return "border-indigo-300 bg-indigo-50 text-indigo-700";
    case "PARTIALLY_SHIPPED":
      return "border-violet-300 bg-violet-50 text-violet-700";
    case "SHIPPED":
      return "border-violet-300 bg-violet-50 text-violet-700";
    case "OUT_FOR_DELIVERY":
      return "border-blue-300 bg-blue-50 text-blue-700";
    case "DELIVERY_FAILED":
      return "border-orange-300 bg-orange-50 text-orange-700";
    case "ADDRESS_CORRECTION_REQUIRED":
      return "border-orange-400 bg-orange-100 text-orange-800";
    case "READY_FOR_REDELIVERY":
      return "border-emerald-400 bg-emerald-50 text-emerald-800";
    case "DELIVERED":
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
    case "RETURNED":
      return "border-zinc-300 bg-zinc-50 text-zinc-700";
    case "CANCELED":
      return "border-red-300 bg-red-50 text-red-700";
    default:
      return "border-zinc-300 bg-zinc-100 text-zinc-700";
  }
}
