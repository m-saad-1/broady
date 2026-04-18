"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { NotificationItem } from "@/types/marketplace";

type NotificationsLoadMoreProps = {
  items: NotificationItem[];
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function NotificationsLoadMore({ items }: NotificationsLoadMoreProps) {
  const [visibleCount, setVisibleCount] = useState(5);

  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);

  if (!items.length) {
    return <p className="text-sm text-zinc-600">No notifications found for this vendor group yet.</p>;
  }

  return (
    <div className="space-y-3">
      {visibleItems.map((notification) => (
        <article key={notification.id} className="border border-zinc-200 p-3 text-sm">
          <p className="font-semibold uppercase tracking-[0.08em]">{notification.title}</p>
          <p className="text-zinc-600">{notification.message}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.12em] text-zinc-500">{formatDateTime(notification.createdAt)}</p>
        </article>
      ))}

      {items.length > visibleCount ? (
        <button
          type="button"
          onClick={() => setVisibleCount((current) => current + 5)}
          className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]"
        >
          Load More
        </button>
      ) : null}

      <Link href="/account/notifications" className="inline-flex text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600">
        View all notifications
      </Link>
    </div>
  );
}
