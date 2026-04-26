type RoleContext = "USER" | "BRAND" | "ADMIN";

type NotificationRecordLike = {
  title: string;
  message: string;
  orderId?: string | null;
};

function extractBrandName(message: string) {
  const byMatch = message.match(/\bby\s+([A-Za-z0-9 &'-]+)\./i);
  if (byMatch?.[1]) return byMatch[1].trim();

  const yourItemMatch = message.match(/\byour\s+([A-Za-z0-9 &'-]+)\s+item has been delivered/i);
  if (yourItemMatch?.[1]) return yourItemMatch[1].trim();

  return undefined;
}

export function normalizeOrderNotificationPresentation<T extends NotificationRecordLike>(item: T, role: RoleContext): T {
  const titleLower = item.title.toLowerCase();
  const messageLower = item.message.toLowerCase();
  const hasShippedKeyword = titleLower.includes("order shipped") || messageLower.includes("has been shipped");
  const hasDeliveredKeyword = titleLower.includes("order delivered") || messageLower.includes("has been delivered");

  // Repair inconsistent records like "Order Shipped" + "...item has been delivered."
  if (!(hasShippedKeyword && hasDeliveredKeyword)) {
    return item;
  }

  const orderIdMatch = item.message.match(/\border\s+([a-z0-9]+)\b/i);
  const orderId = item.orderId || orderIdMatch?.[1] || "your order";
  const brandName = extractBrandName(item.message);

  if (role === "USER") {
    return {
      ...item,
      title: "Order Delivered",
      message: brandName
        ? `Order ${orderId} has been delivered. Your ${brandName} item has been delivered.`
        : `Order ${orderId} has been delivered.`,
    };
  }

  if (role === "BRAND") {
    return {
      ...item,
      title: "Order Delivered",
      message: `Order ${orderId} has been delivered.`,
    };
  }

  return {
    ...item,
    title: "Order Delivered",
    message: brandName
      ? `Order ${orderId} has been delivered by ${brandName}.`
      : `Order ${orderId} has been delivered.`,
  };
}

