import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { formatPkr } from "@/lib/utils";
import { getOrderStatusLabel, getOrderStatusTone } from "@/lib/order-status";
import type { NotificationItem, UserOrder } from "@/types/marketplace";

type AccountOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

async function fetchOrder(orderId: string, token: string): Promise<UserOrder> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/orders/me/${orderId}`, {
    headers: { Cookie: `broady_token=${token}` },
    cache: "no-store",
  });

  if (response.status === 404) notFound();
  if (response.status === 401 || response.status === 403) redirect("/login?next=/account");
  if (!response.ok) throw new Error("ORDER_FETCH_FAILED");

  const json = (await response.json()) as { data: UserOrder };
  return json.data;
}

async function fetchOrderNotifications(orderId: string, token: string): Promise<NotificationItem[]> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/users/notifications`, {
    headers: { Cookie: `broady_token=${token}` },
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    return [];
  }

  if (!response.ok) {
    return [];
  }

  const json = (await response.json()) as { data: NotificationItem[] };
  return json.data
    .filter((item) => item.order?.id === orderId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AccountOrderDetailPage({ params }: AccountOrderDetailPageProps) {
  const token = (await cookies()).get("broady_token")?.value;
  if (!token) redirect("/login?next=/account");

  const { id } = await params;
  const [order, notifications] = await Promise.all([fetchOrder(id, token), fetchOrderNotifications(id, token)]);
  const brandUpdates = order.statusLogs.filter((log) => (log.updatedBy === "BRAND" || log.updatedBy === "ADMIN") && Boolean(log.note));

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Account Order Detail</p>
        <h1 className="font-heading text-5xl uppercase">Order {order.id.slice(0, 10)}...</h1>
        <p className="text-sm text-zinc-600">Use this page to review the full order timeline, item breakdown, and support details.</p>
      </header>

      <section className="grid gap-4 border border-zinc-300 p-5 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Status</p>
          <p className={`mt-2 inline-flex border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${getOrderStatusTone(order.status)}`}>{getOrderStatusLabel(order.status)}</p>
          <p className="mt-2 text-sm text-zinc-600">Tracking ID: {order.trackingId || "Pending assignment"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Payment</p>
          <p className="mt-2 text-sm font-semibold">{order.paymentMethod} / {order.paymentStatus}</p>
          <p className="mt-2 text-sm text-zinc-600">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Delivery Address</p>
          <p className="mt-2 text-sm text-zinc-700">{order.deliveryAddress}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Total</p>
          <p className="mt-2 text-sm font-semibold">{formatPkr(order.totalPkr)}</p>
        </div>
      </section>

      <section className="space-y-3 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Items</h2>
        <div className="space-y-3">
          {order.items.map((item) => (
            <article key={item.id} className="grid gap-2 border-b border-zinc-200 py-3 md:grid-cols-[2fr_1fr_1fr]">
              <div>
                <Link
                  href={`/product/${item.product.slug}`}
                  className="text-sm font-semibold uppercase tracking-[0.08em] underline decoration-zinc-400 underline-offset-2"
                >
                  {item.product.name}
                </Link>
                <p className="text-xs text-zinc-600">{item.product.brand?.name || item.brand?.name || "Brand"} / {item.product.topCategory} / {item.product.subCategory}</p>
              </div>
              <p className="text-sm">Qty {item.quantity}</p>
              <p className="text-sm">{formatPkr(item.unitPricePkr)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Status Timeline</h2>
        <div className="space-y-3">
          {order.statusLogs.map((log) => (
            <article key={log.id} className="border border-zinc-200 p-3 text-sm">
              <p className="font-semibold uppercase tracking-[0.08em]">{getOrderStatusLabel(log.status)}</p>
              <p className="text-zinc-600">
                {log.updatedBy}
                {log.note ? ` - ${log.note}` : ""}
              </p>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{formatDateTime(log.createdAt)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Updates from Brand</h2>
        {brandUpdates.length ? (
          <div className="space-y-3">
            {brandUpdates.map((log) => (
              <article key={`${log.id}-customer-note`} className="border border-zinc-200 p-3 text-sm">
                <p className="font-semibold uppercase tracking-[0.08em]">{getOrderStatusLabel(log.status)}</p>
                <p className="text-zinc-700">{log.note}</p>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{formatDateTime(log.createdAt)}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">No customer-visible updates from the brand yet.</p>
        )}
      </section>

      <section className="space-y-4 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Support</h2>
        <p className="text-sm text-zinc-700">Send the order reference to support for payment, delivery, or return questions.</p>
        <div className="flex flex-wrap gap-2">
          <a href={`mailto:support@broady.pk?subject=Support%20request%20for%20order%20${order.id}`} className="inline-flex h-11 items-center justify-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            Contact support
          </a>
          <Link href="/account" className="inline-flex h-11 items-center justify-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            Help center
          </Link>
        </div>
      </section>

      <section className="space-y-3 border border-zinc-300 p-5">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-heading text-3xl uppercase">Notifications</h2>
          <Link href="/account/notifications" className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600">
            View all
          </Link>
        </div>
        {notifications.length ? (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <article key={notification.id} className="border border-zinc-200 p-3 text-sm">
                <p className="font-semibold uppercase tracking-[0.08em]">{notification.title}</p>
                <p className="text-zinc-600">{notification.message}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.12em] text-zinc-500">{formatDateTime(notification.createdAt)}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">No recent notifications for this order.</p>
        )}
      </section>
    </main>
  );
}
