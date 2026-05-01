"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { ProductImage } from "@/components/ui/product-image";
import { getBrandDashboardOrder, updateBrandOrderStatus } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media-url";
import { getOrderStatusLabel, getOrderStatusOptions, getOrderStatusTone } from "@/lib/order-status";
import { formatPkr } from "@/lib/utils";
import { useToastStore } from "@/stores/toast-store";
import type { BrandDashboardOrder, OrderStatus } from "@/types/marketplace";

type BrandOrderDetailClientProps = {
  orderId: string;
};

function formatDateTime(value?: string | null) {
  if (!value) return "N/A";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(parsed);
}

function resolveProductImageSrc(imageUrl?: string | null) {
  return resolveMediaUrl(imageUrl);
}

export function BrandOrderDetailClient({ orderId }: BrandOrderDetailClientProps) {
  const pushToast = useToastStore((state) => state.pushToast);
  const [order, setOrder] = useState<BrandDashboardOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [draft, setDraft] = useState<{ status: OrderStatus; trackingId: string; note: string; customerNote: string } | null>(null);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      const nextOrder = await getBrandDashboardOrder(orderId);
      setOrder(nextOrder);
      setDraft({
        status: nextOrder.status,
        trackingId: nextOrder.trackingId || "",
        note: "",
        customerNote: "",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load order details";
      pushToast(message, "error");
      setOrder(null);
      setDraft(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, pushToast]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const applyUpdate = async () => {
    if (!order || !draft) return;

    if (draft.status === "SHIPPED" && !draft.trackingId.trim()) {
      pushToast("Tracking ID is required when status is Shipped.", "error");
      return;
    }

    setSaving(true);
    try {
      await updateBrandOrderStatus(order.id, {
        status: draft.status,
        trackingId: draft.trackingId.trim() || undefined,
        note: draft.note.trim() || undefined,
        customerNote: draft.customerNote.trim() || undefined,
      });
      pushToast("Order updated", "success");
      await loadOrder();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update order";
      pushToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDescription = useMemo(() => {
    if (!order || !draft) return "";
    return `Order ${order.id} will be updated to ${draft.status}${draft.trackingId ? ` with tracking ${draft.trackingId}` : ""}.`;
  }, [draft, order]);

  if (loading) {
    return <p className="text-sm text-zinc-600">Loading order details...</p>;
  }

  if (!order || !draft) {
    return (
      <section className="space-y-3 border border-amber-300 bg-amber-50 p-5">
        <h2 className="font-heading text-4xl uppercase">Unable to load order</h2>
        <p className="text-sm text-amber-900">Please return to orders and try again.</p>
        <Link href="/brand/orders" className="inline-flex h-11 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
          Back to orders
        </Link>
      </section>
    );
  }

  const customerName = order.user?.fullName || "Customer";
  const customerEmail = order.user?.email || "Email unavailable";

  return (
    <div className="space-y-8">
      <section className="grid gap-4 border border-zinc-300 p-5 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Order ID</p>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.08em]">{order.id}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Customer</p>
          <p className="mt-2 text-sm font-semibold">{customerName}</p>
          <p className="text-sm text-zinc-600">{customerEmail}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Current Status</p>
          <p className={`mt-2 inline-flex border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${getOrderStatusTone(order.status)}`}>{getOrderStatusLabel(order.status)}</p>
          <p className="text-sm text-zinc-600">{order.paymentMethod} / {order.paymentStatus}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Tracking</p>
          <p className="mt-2 text-sm font-semibold">{order.trackingId || "Not assigned"}</p>
          <p className="mt-2 text-sm text-zinc-600">Delivery attempts: {order.deliveryAttempts || 0}</p>
          {order.failureReason ? <p className="mt-2 text-sm text-orange-800">Failure reason: {order.failureReason}</p> : null}
          {order.nextAttemptDate ? <p className="mt-2 text-sm text-blue-800">Next attempt: {formatDateTime(order.nextAttemptDate)}</p> : null}
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
        <h2 className="font-heading text-3xl uppercase">Update Order</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <select
            className={`h-10 border px-3 text-sm ${
              draft.status === "SHIPPED"
                ? "border-blue-300 bg-blue-50"
                : draft.status === "DELIVERED"
                  ? "border-emerald-300 bg-emerald-50"
                  : draft.status === "CANCELED"
                    ? "border-rose-300 bg-rose-50"
                    : "border-zinc-300 bg-white"
            }`}
            value={draft.status}
            onChange={(event) => setDraft((current) => current ? { ...current, status: event.target.value as OrderStatus } : current)}
          >
            {getOrderStatusOptions(order.status).map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setPendingConfirm(true)}
            disabled={saving}
            className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
          >
            {saving ? "Saving" : "Apply Update"}
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="h-10 border border-zinc-300 px-3 text-sm"
            placeholder="Tracking ID"
            value={draft.trackingId}
            onChange={(event) => setDraft((current) => current ? { ...current, trackingId: event.target.value } : current)}
          />
          <input
            className="h-10 border border-zinc-300 px-3 text-sm"
            placeholder="Internal note"
            value={draft.note}
            onChange={(event) => setDraft((current) => current ? { ...current, note: event.target.value } : current)}
          />
          <input
            className="h-10 border border-zinc-300 px-3 text-sm md:col-span-2"
            placeholder="Customer-visible note"
            value={draft.customerNote}
            onChange={(event) => setDraft((current) => current ? { ...current, customerNote: event.target.value } : current)}
          />
        </div>
      </section>

      <section className="space-y-3 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Items</h2>
        <div className="space-y-3">
          {order.items.map((item) => (
            <article key={item.id} className="grid gap-4 border-b border-zinc-200 py-3 md:grid-cols-[80px_1fr_auto] md:items-center">
              <div className="relative h-20 w-20 overflow-hidden border border-zinc-200 bg-zinc-50">
                <ProductImage
                  src={resolveProductImageSrc(item.product.imageUrl)}
                  alt={item.product.name || "Product image"}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
              <div className="space-y-1">
                <Link href={`/product/${item.product.slug}`} className="text-sm font-semibold uppercase tracking-[0.08em] underline decoration-zinc-400 underline-offset-2">
                  {item.product.name}
                </Link>
                <div className="flex flex-wrap gap-3 text-xs text-zinc-700">
                  <p className="font-semibold">Size: {item.selectedSize || "Not specified"}</p>
                  <p className="font-semibold">Color: {item.selectedColor || "Not specified"}</p>
                  <p className="font-semibold">Quantity: {item.quantity}</p>
                  <p className="font-semibold">Price: {formatPkr(item.unitPricePkr)}</p>
                </div>
              </div>
              <Link href={`/product/${item.product.slug}`} className="inline-flex h-9 items-center border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em] leading-9 text-center">
                Product
              </Link>
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
              <p className="text-zinc-600">{log.updatedBy}{log.note ? ` - ${log.note}` : ""}</p>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{formatDateTime(log.createdAt)}</p>
            </article>
          ))}
        </div>
      </section>

      <ConfirmModal
        open={pendingConfirm}
        title="Confirm Status Update"
        description={confirmDescription}
        confirmText="Confirm update"
        cancelText="Review"
        onCancel={() => setPendingConfirm(false)}
        onConfirm={() => {
          setPendingConfirm(false);
          void applyUpdate();
        }}
      />
    </div>
  );
}
