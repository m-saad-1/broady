import type { OrderStatusLog } from "@/types/marketplace";

const CANCELLED_ITEMS_PREFIX = "CANCELLED_ITEMS:";

export function getCancelledOrderItemIds(statusLogs: OrderStatusLog[] = []) {
  const ids = new Set<string>();

  for (const log of statusLogs) {
    const note = log.note || "";
    const markerIndex = note.indexOf(CANCELLED_ITEMS_PREFIX);
    if (markerIndex < 0) continue;

    const afterMarker = note.slice(markerIndex + CANCELLED_ITEMS_PREFIX.length);
    const idList = afterMarker.split("|")[0] || "";
    for (const id of idList.split(",")) {
      const trimmed = id.trim();
      if (trimmed) ids.add(trimmed);
    }
  }

  return ids;
}

