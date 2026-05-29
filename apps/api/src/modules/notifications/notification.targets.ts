type NotificationTargetInput = {
  type: string;
  orderId?: string;
  subOrderId?: string;
  message?: string;
  title?: string;
  role?: string;
  isBrandContext?: boolean;
};

function isAdminRole(role?: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function isBrandRole(role?: string) {
  return role === "BRAND" || role === "BRAND_ADMIN" || role === "BRAND_STAFF";
}

function isReviewType(type: string) {
  return type.startsWith("PRODUCT_REVIEW_");
}

function isAuthType(type: string) {
  return type === "ACCOUNT_VERIFICATION" || type === "PASSWORD_RESET";
}

function extractSubOrderId(input: NotificationTargetInput) {
  if (input.subOrderId) return input.subOrderId;
  const message = input.message || "";
  const title = input.title || "";
  const source = `${title} ${message}`;
  const match = source.match(/sub-order\s+([a-z0-9]+)/i);
  return match?.[1] || undefined;
}

export function resolveNotificationTargetPath(input: NotificationTargetInput): string {
  const subOrderId = extractSubOrderId(input);

  if (isAdminRole(input.role)) {
    if (input.orderId && subOrderId) return `/admin/orders/${input.orderId}?subOrderId=${encodeURIComponent(subOrderId)}`;
    if (input.orderId) return `/admin/orders/${input.orderId}`;
    if (input.type === "BRAND_ORDER_ASSIGNED") return "/admin/products";
    if (isReviewType(input.type)) return "/admin/reviews";
    return "/admin";
  }

  if (isAuthType(input.type)) {
    if (input.type === "PASSWORD_RESET") return "/login";
    return "/account";
  }

  if (input.isBrandContext || isBrandRole(input.role)) {
    if (input.orderId && subOrderId) return `/brand/orders/${input.orderId}?subOrderId=${encodeURIComponent(subOrderId)}`;
    if (input.orderId) return `/brand/orders/${input.orderId}`;
    if (input.type === "BRAND_ORDER_ASSIGNED") return "/brand/products";
    if (isReviewType(input.type)) return "/brand/dashboard/reviews";
    return "/brand/dashboard";
  }

  if (input.orderId && subOrderId) return `/account/orders/${input.orderId}/groups/${encodeURIComponent(subOrderId)}`;
  if (input.orderId) return `/account/orders/${input.orderId}`;
  if (isReviewType(input.type)) return "/account/reviews";
  return "/account/notifications";
}
