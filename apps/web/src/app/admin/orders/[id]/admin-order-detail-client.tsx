"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { formatPkr } from "@/lib/utils";
import type { UserOrder } from "@/types/marketplace";

type AdminOrderDetailClientProps = {
  initialOrder: UserOrder;
};

export function AdminOrderDetailClient({ initialOrder }: AdminOrderDetailClientProps) {
  const searchParams = useSearchParams();
  const order = initialOrder;
  const focusedSubOrderId = searchParams.get("subOrderId") || "";
  const focusedSubOrder = useMemo(
    () => order.subOrders.find((subOrder) => subOrder.id === focusedSubOrderId) || null,
    [focusedSubOrderId, order.subOrders],
  );

  return (
    <section className="space-y-5">
      {focusedSubOrder ? (
        <section className="space-y-2 border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-emerald-700">Focused Vendor Group</p>
          <p className="text-sm font-semibold uppercase tracking-[0.08em]">{focusedSubOrder.brand?.name || "Brand"} - {focusedSubOrder.id}</p>
          <p className="text-sm text-emerald-900">Status: {focusedSubOrder.status}</p>
        </section>
      ) : null}

      <section className="grid gap-4 border border-zinc-300 p-5 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Order</p>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.08em]">{order.id}</p>
          <p className="text-sm text-zinc-600">Placed {new Date(order.createdAt).toLocaleString("en-PK")}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Customer</p>
          <p className="mt-2 text-sm font-semibold">{order.user.fullName}</p>
          <p className="text-sm text-zinc-600">{order.user.email}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Payment</p>
          <p className="mt-2 text-sm font-semibold">{order.paymentMethod} / {order.paymentStatus}</p>
          <p className="text-sm text-zinc-600">Total: {formatPkr(order.totalPkr)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Delivery Address</p>
          <p className="mt-2 text-sm text-zinc-700">{order.deliveryAddress}</p>
        </div>
      </section>

      <section className="space-y-3 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Order Status</h2>
        <p className="text-sm text-zinc-700">Status updates are disabled in the Admin Brand Dashboard. This page is read-only for monitoring.</p>
        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
          Latest update: {order.statusLogs[0]?.status || order.status} by {order.statusLogs[0]?.updatedBy || "SYSTEM"} at {new Date(order.statusLogs[0]?.createdAt || order.updatedAt).toLocaleString("en-PK")}
        </p>
      </section>

      <section className="space-y-3 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Items</h2>
        <div className="space-y-3">
          {order.items.map((item) => (
            <article key={item.id} className="grid gap-2 border-b border-zinc-200 py-3 md:grid-cols-[2fr_1fr_1fr_auto]">
              <div>
                <Link href={`/product/${item.product.slug}`} className="text-sm font-semibold uppercase tracking-[0.08em] underline decoration-zinc-400 underline-offset-2">
                  {item.product.name}
                </Link>
                <p className="text-xs text-zinc-600">{item.product.brand?.name || item.brand?.name || "Brand"} / {item.product.topCategory} / {item.product.subCategory}</p>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-700">
                  <p className="font-semibold">Size: {item.selectedSize || "Not specified"}</p>
                  <p className="font-semibold">Color: {item.selectedColor || "Not specified"}</p>
                  <p className="font-semibold">Quantity: {item.quantity}</p>
                  <p className="font-semibold">Price: {formatPkr(item.unitPricePkr)}</p>
                </div>
              </div>
              <div />
              <div />
              <Link href={`/product/${item.product.slug}`} className="h-9 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em] leading-9 text-center">
                Product
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Status Timeline</h2>
        <div className="space-y-3">
          {order.statusLogs.map((log) => (
            <article key={log.id} className="border border-zinc-200 p-3 text-sm">
              <p className="font-semibold uppercase tracking-[0.08em]">{log.status}</p>
              <p className="text-zinc-600">{log.updatedBy}{log.note ? ` - ${log.note}` : ""}</p>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{new Date(log.createdAt).toLocaleString("en-PK")}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
