import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderStatusLabel, getOrderStatusTone } from "@/lib/order-status";
import { formatPkr } from "@/lib/utils";
import type { BrandDashboardOrder } from "@/types/marketplace";
import { getBrandSession } from "../../_lib/brand-session";

type BrandOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BrandOrderDetailPage({ params }: BrandOrderDetailPageProps) {
  const { token } = await getBrandSession();
  const { id } = await params;

  let order: BrandDashboardOrder | null = null;
  let hasError = false;

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/brand-dashboard/orders/${id}`, {
      headers: { Cookie: `broady_token=${token}` },
      cache: "no-store",
    });

    if (response.status === 404) {
      notFound();
    }

    if (!response.ok) {
      hasError = true;
    } else {
      const json = (await response.json()) as { data: BrandDashboardOrder };
      order = json.data;
    }
  } catch {
    hasError = true;
  }

  if (hasError || !order) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 lg:px-10">
        <section className="space-y-3 border border-amber-300 bg-amber-50 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-amber-700">Order Details</p>
          <h1 className="font-heading text-4xl uppercase">Unable to load order</h1>
          <p className="text-sm text-amber-900">Please refresh or return to the orders list and try again.</p>
          <Link href="/brand/orders" className="inline-flex h-11 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            Back to orders
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Brand Order Detail</p>
        <h1 className="font-heading text-5xl uppercase">Order {order.id.slice(0, 10)}...</h1>
        <p className="text-sm text-zinc-600">This detail view is filtered to the signed-in brand only.</p>
      </header>

      <section className="grid gap-4 border border-zinc-300 p-5 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Customer</p>
          <p className="mt-2 text-sm font-semibold">{order.user.fullName}</p>
          <p className="text-sm text-zinc-600">{order.user.email}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Status</p>
          <p className={`mt-2 inline-flex border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${getOrderStatusTone(order.status)}`}>{getOrderStatusLabel(order.status)}</p>
          <p className="text-sm text-zinc-600">{order.paymentMethod} / {order.paymentStatus}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Tracking</p>
          <p className="mt-2 text-sm font-semibold">{order.trackingId || "Not assigned"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Total</p>
          <p className="mt-2 text-sm font-semibold">{formatPkr(order.totalPkr)}</p>
        </div>
        <div className="md:col-span-2">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Delivery Address</p>
          <p className="mt-2 text-sm text-zinc-700">{order.deliveryAddress}</p>
        </div>
      </section>

      <section className="space-y-3 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Items</h2>
        <div className="space-y-3">
          {order.items.map((item) => (
            <article key={item.id} className="grid gap-2 border-b border-zinc-200 py-3 md:grid-cols-[2fr_1fr_1fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.08em]">{item.product.name}</p>
                <p className="text-xs text-zinc-600">{item.product.topCategory} / {item.product.subCategory}</p>
              </div>
              <p className="text-sm">Qty {item.quantity}</p>
                <p className="text-sm">{formatPkr(item.unitPricePkr)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Status Log</h2>
        <div className="space-y-3">
          {order.statusLogs.map((log) => (
            <article key={log.id} className="border border-zinc-200 p-3 text-sm">
              <p className="font-semibold uppercase tracking-[0.08em]">{getOrderStatusLabel(log.status)}</p>
              <p className="text-zinc-600">{log.updatedBy} {log.note ? `- ${log.note}` : ""}</p>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{new Date(log.createdAt).toLocaleString("en-PK")}</p>
            </article>
          ))}
        </div>
      </section>

      <Link href="/brand/orders" className="inline-flex h-11 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
        Back to orders
      </Link>
    </main>
  );
}