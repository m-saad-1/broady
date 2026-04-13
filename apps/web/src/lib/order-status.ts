import type { OrderStatus } from "@/types/marketplace";

export const customerOrderStatusOptions: OrderStatus[] = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELED"];

export const legacyOrderStatusOptions: OrderStatus[] = ["PENDING", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELED"];

export function getOrderStatusOptions(currentStatus: OrderStatus) {
  return currentStatus === "PACKED" ? legacyOrderStatusOptions : customerOrderStatusOptions;
}

export function getOrderStatusLabel(status: OrderStatus) {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "CONFIRMED":
      return "Confirmed";
    case "PACKED":
      return "Packed";
    case "SHIPPED":
      return "Shipped";
    case "DELIVERED":
      return "Delivered";
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
    case "PACKED":
      return "border-indigo-300 bg-indigo-50 text-indigo-700";
    case "SHIPPED":
      return "border-violet-300 bg-violet-50 text-violet-700";
    case "DELIVERED":
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
    case "CANCELED":
      return "border-red-300 bg-red-50 text-red-700";
    default:
      return "border-zinc-300 bg-zinc-100 text-zinc-700";
  }
}
