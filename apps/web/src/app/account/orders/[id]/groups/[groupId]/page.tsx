import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ProductImage } from "@/components/ui/product-image";
import { formatPkr } from "@/lib/utils";
import { getOrderStatusLabel, getOrderStatusTone } from "@/lib/order-status";
import type { NotificationItem, UserOrder } from "@/types/marketplace";
import { NotificationsLoadMore } from "./notifications-load-more";

type VendorGroupDetailPageProps = {
  params: Promise<{ id: string; groupId: string }>;
};

async function fetchOrder(orderId: string, token: string): Promise<UserOrder> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/orders/me/${orderId}`, {
    headers: { Cookie: `broady_token=${token}` },
    cache: "no-store",
  });

  if (response.status === 404) notFound();
  if (response.status === 401 || response.status === 403) redirect("/login?next=/account/orders");
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
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function resolveProductImageSrc(imageUrl?: string | null) {
  const normalized = (imageUrl || "").trim();
  return normalized || "/window.svg";
}

export default async function VendorGroupDetailPage({ params }: VendorGroupDetailPageProps) {
  const token = (await cookies()).get("broady_token")?.value;
  if (!token) redirect("/login?next=/account/orders");

  const { id, groupId } = await params;
  const [order, notifications] = await Promise.all([fetchOrder(id, token), fetchOrderNotifications(id, token)]);

  const group = order.subOrders.find((item) => item.id === groupId);
  if (!group) {
    notFound();
  }

  const groupNotifications = notifications.filter((item) => {
    const message = item.message?.toLowerCase() || "";
    const title = item.title?.toLowerCase() || "";
    const brandName = group.brand?.name?.toLowerCase() || "";
    return brandName ? message.includes(brandName) || title.includes(brandName) : true;
  });

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Order Detail</p>
        <h1 className="font-heading text-5xl uppercase">{group.brand?.name || "Brand"} Group</h1>
        <p className="text-sm text-zinc-600">Group {group.id.slice(0, 10)}... in order {order.id.slice(0, 10)}...</p>
      </header>

      <section className="grid gap-4 border border-zinc-300 p-5 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Status</p>
          <p className={`mt-2 inline-flex border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${getOrderStatusTone(group.status)}`}>
            {getOrderStatusLabel(group.status)}
          </p>
          <p className="mt-2 text-sm text-zinc-600">Tracking ID: {group.trackingId || "Pending assignment"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Brand</p>
          <p className="mt-2 text-sm font-semibold">{group.brand?.name || "Brand"}</p>
          <p className="mt-2 text-sm text-zinc-600">Placed {formatDateTime(group.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Group Subtotal</p>
          <p className="mt-2 text-sm font-semibold">{formatPkr(group.subtotalPkr)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Order Metadata</p>
          <p className="mt-2 text-sm text-zinc-700">Payment: {order.paymentMethod} / {order.paymentStatus}</p>
          <p className="mt-2 text-sm text-zinc-700">Delivery: {order.deliveryAddress}</p>
        </div>
      </section>

      <section className="space-y-3 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Items</h2>
        <div className="space-y-3">
          {group.items.map((item) => (
            <article key={item.id} className="grid gap-3 border-b border-zinc-200 py-3 md:grid-cols-[72px_1fr_auto] md:items-center">
              <div className="relative h-14 w-14 overflow-hidden border border-zinc-200">
                <ProductImage
                  src={resolveProductImageSrc(item.product.imageUrl)}
                  alt={item.product.name || "Product image"}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </div>

              <div>
                <Link
                  href={`/product/${item.product.slug}`}
                  className="text-sm font-semibold uppercase tracking-[0.08em] underline decoration-zinc-400 underline-offset-2"
                >
                  {item.product.name}
                </Link>
                <p className="mt-1 text-xs text-zinc-600">Size: {item.selectedSize || "Not specified"}</p>
                <p className="text-xs text-zinc-600">Color: {item.selectedColor || "Not specified"}</p>
                <p className="text-xs text-zinc-600">Quantity: {item.quantity}</p>
                <p className="text-xs text-zinc-600">Price: {formatPkr(item.unitPricePkr)}</p>
              </div>

              <Link
                href={`/account/reviews?orderItemId=${encodeURIComponent(item.id)}`}
                className="inline-flex h-9 items-center border border-black bg-black px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
              >
                Review
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Status Timeline</h2>
        <div className="space-y-3">
          {group.statusLogs.map((log) => (
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
        <h2 className="font-heading text-3xl uppercase">Related Notifications</h2>
        <NotificationsLoadMore items={groupNotifications} />
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/account/orders" className="inline-flex h-11 items-center justify-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
          Back to Orders
        </Link>
      </div>
    </main>
  );
}
