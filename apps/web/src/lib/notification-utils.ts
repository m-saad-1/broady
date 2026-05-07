/**
 * Masks an order ID to display format XXXX...XXXX (first 4 chars + ... + last 4 chars)
 * Example: cmosz2xwz001rh2787jfwsw5o -> cmosz...wswso
 */
export function maskOrderId(orderId: string): string {
  if (!orderId || orderId.length <= 8) {
    return orderId;
  }
  
  const firstFour = orderId.substring(0, 4);
  const lastFour = orderId.substring(orderId.length - 4);
  
  return `${firstFour}...${lastFour}`;
}

/**
 * Gets the display version of an order ID (masked)
 * Used throughout the notification system
 */
export function getOrderIdDisplay(orderId?: string): string {
  return orderId ? maskOrderId(orderId) : "N/A";
}
