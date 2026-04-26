import type { NotificationItem, User } from "@/types/marketplace";

function isAdminRole(role?: User["role"]) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function isBrandRole(role?: User["role"]) {
  return role === "BRAND" || role === "BRAND_ADMIN" || role === "BRAND_STAFF";
}

function isReviewNotification(type: NotificationItem["type"]) {
  return type.startsWith("PRODUCT_REVIEW_");
}

export function getNotificationHref(item: NotificationItem, role?: User["role"]): string {
  if (item.targetPath) {
    return item.targetPath;
  }

  if (isAdminRole(role)) {
    if (item.order?.id) return `/admin/orders/${item.order.id}`;
    if (item.type === "BRAND_ORDER_ASSIGNED") return "/admin/products";
    if (isReviewNotification(item.type)) return "/admin/reviews";
    return "/admin";
  }

  if (isBrandRole(role)) {
    if (item.order?.id) return `/brand/orders/${item.order.id}`;
    if (isReviewNotification(item.type)) return "/brand/dashboard/reviews";
    return "/brand/dashboard";
  }

  if (item.order?.id) return `/account/orders/${item.order.id}`;
  if (isReviewNotification(item.type)) return "/account/reviews";
  return "/account/notifications";
}
