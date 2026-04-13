"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getUserNotifications } from "@/lib/api";
import type { NotificationItem } from "@/types/marketplace";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AccountNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getUserNotifications()
      .then((items) => {
        if (!active) return;
        const sorted = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(sorted);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load notifications.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Account</p>
        <h1 className="font-heading text-5xl uppercase">All Notifications</h1>
        <p className="text-sm text-zinc-600">See all updates related to your orders, account activity, and marketplace alerts.</p>
      </header>

      {loading ? <p className="text-sm text-zinc-700">Loading notifications...</p> : null}
      {error ? <p className="text-sm text-amber-700">{error}</p> : null}

      {!loading && !error ? (
        notifications.length ? (
          <section className="space-y-3">
            {notifications.map((item) => (
              <article key={item.id} className="border border-zinc-300 p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold uppercase tracking-[0.08em]">{item.title}</p>
                  {!item.readAt ? <span className="border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">New</span> : null}
                </div>
                <p className="mt-2 text-zinc-700">{item.message}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.12em] text-zinc-500">{formatDateTime(item.createdAt)}</p>
                {item.order?.id ? (
                  <Link href={`/account/orders/${item.order.id}`} className="mt-3 inline-flex border border-zinc-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
                    Open order
                  </Link>
                ) : null}
              </article>
            ))}
          </section>
        ) : (
          <section className="border border-zinc-300 p-6">
            <p className="text-sm text-zinc-700">No notifications found.</p>
          </section>
        )
      ) : null}
    </main>
  );
}
