"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { ProductImage } from "@/components/ui/product-image";
import { cancelBrandOrder, getBrandDashboardOrder, updateBrandOrderStatus } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media-url";
import { getCancelledOrderItemIds } from "@/lib/order-cancellation";
import { getOrderStatusLabel, getOrderStatusOptions, getOrderStatusTone } from "@/lib/order-status";
import { formatPkr } from "@/lib/utils";
import { useToastStore } from "@/stores/toast-store";
import type { BrandDashboardOrder, OrderStatus } from "@/types/marketplace";

type BrandOrderDetailClientProps = {
  orderId: string;
};

const DELIVERY_FAILURE_REASONS = [
  { code: "CUSTOMER_NOT_AVAILABLE", label: "Customer not available" },
  { code: "INCORRECT_ADDRESS", label: "Incorrect address" },
  { code: "PHONE_UNREACHABLE", label: "Phone unreachable" },
  { code: "REFUSED_DELIVERY", label: "Refused delivery" },
  { code: "AREA_NOT_SERVICEABLE", label: "Area not serviceable" },
  { code: "OTHER", label: "Other" },
];

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
  const [openCancelModal, setOpenCancelModal] = useState(false);
  const [cancelReasonCode, setCancelReasonCode] = useState<"OUT_OF_STOCK" | "ITEM_DAMAGED">("OUT_OF_STOCK");
  const [cancelNote, setCancelNote] = useState("");
  const [selectedCancelItemIds, setSelectedCancelItemIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<{
    status: OrderStatus;
    trackingId: string;
    courierName: string;
    estimatedDelivery: string;
    note: string;
    failureReason: string;
    failureReasonMessage: string;
    nextAttemptDate: string;
  } | null>(null);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      const nextOrder = await getBrandDashboardOrder(orderId);
      setOrder(nextOrder);
      setDraft({
        status: nextOrder.status,
        trackingId: nextOrder.trackingId || "",
        courierName: nextOrder.courierName || "",
        estimatedDelivery: nextOrder.estimatedDelivery || "",
        note: "",
        failureReason: "",
        failureReasonMessage: "",
        nextAttemptDate: "",
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

    if (draft.status === "DELIVERY_FAILED" && !draft.failureReason.trim()) {
      pushToast("Failure reason is required when marking delivery as failed.", "error");
      return;
    }

    if (draft.status === "DELIVERY_FAILED" && draft.failureReason === "OTHER" && !draft.failureReasonMessage.trim()) {
      pushToast("Custom failure text is required when choosing Other.", "error");
      return;
    }

    if (draft.status === "DELIVERY_FAILED" && draft.failureReason === "INCORRECT_ADDRESS" && !draft.note.trim()) {
      pushToast("Internal note is required when marking delivery failed for an incorrect address.", "error");
      return;
    }

    setSaving(true);
    try {
      await updateBrandOrderStatus(order.id, {
        status: draft.status,
        trackingId: draft.trackingId.trim() || undefined,
        courierName: draft.courierName.trim() || undefined,
        estimatedDelivery: draft.estimatedDelivery.trim() || undefined,
        note: draft.note.trim() || undefined,
        failureReason: draft.failureReason.trim() || undefined,
        failureReasonMessage: draft.failureReasonMessage.trim() || undefined,
        nextAttemptDate: draft.nextAttemptDate ? new Date(draft.nextAttemptDate) : undefined,
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

  const canCancelBeforeShipment = order ? ["PENDING", "CONFIRMED", "PROCESSING"].includes(order.status) : false;

  const applyCancel = async () => {
    if (!order) return;
    if (!selectedCancelItemIds.length) {
      pushToast("Select at least one item to cancel.", "error");
      return;
    }
    setSaving(true);
    try {
      await cancelBrandOrder(order.id, {
        reasonCode: cancelReasonCode,
        note: cancelNote.trim() || undefined,
        orderItemIds: selectedCancelItemIds,
      });
      pushToast("Order canceled successfully.", "success");
      setCancelNote("");
      setOpenCancelModal(false);
      await loadOrder();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to cancel order";
      pushToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

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
  const cancelledItemIds = getCancelledOrderItemIds(order.statusLogs);

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
          {order.courierName && <p className="mt-2 text-sm text-zinc-600">Courier: {order.courierName}</p>}
          {order.estimatedDelivery && <p className="mt-2 text-sm text-zinc-600">Estimated: {formatDateTime(order.estimatedDelivery)}</p>}
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
            onChange={(event) =>
              setDraft((current) => {
                if (!current) return current;
                const nextStatus = event.target.value as OrderStatus;
                const hasEstimated = Boolean(current.estimatedDelivery?.trim());
                if (hasEstimated || (nextStatus !== "SHIPPED" && nextStatus !== "OUT_FOR_DELIVERY")) {
                  return { ...current, status: nextStatus };
                }

                const now = new Date();
                const autoDate = new Date(now.getTime() + (nextStatus === "OUT_FOR_DELIVERY" ? 24 : 72) * 60 * 60 * 1000);
                const yyyy = autoDate.getFullYear();
                const mm = String(autoDate.getMonth() + 1).padStart(2, "0");
                const dd = String(autoDate.getDate()).padStart(2, "0");
                const hh = String(autoDate.getHours()).padStart(2, "0");
                const min = String(autoDate.getMinutes()).padStart(2, "0");
                return { ...current, status: nextStatus, estimatedDelivery: `${yyyy}-${mm}-${dd}T${hh}:${min}` };
              })
            }
          >
            <option value={order.status} disabled>
              Current: {getOrderStatusLabel(order.status)}
            </option>
            {getOrderStatusOptions(order.status).map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            {canCancelBeforeShipment ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedCancelItemIds(order.items.map((item) => item.id));
                  setOpenCancelModal(true);
                }}
                disabled={saving}
                className="h-10 border border-red-300 bg-red-50 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-red-700 disabled:opacity-50"
              >
                Cancel Order
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setPendingConfirm(true)}
              disabled={saving}
              className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
            >
              {saving ? "Saving" : "Apply Update"}
            </button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="h-10 border border-zinc-300 px-3 text-sm"
            placeholder="Tracking ID"
            value={draft.trackingId}
            onChange={(event) => setDraft((current) => current ? { ...current, trackingId: event.target.value } : current)}
          />
          <select
            className="h-10 border border-zinc-300 px-3 text-sm"
            value={draft.courierName}
            onChange={(event) => setDraft((current) => current ? { ...current, courierName: event.target.value } : current)}
          >
            <option value="">-- Select Courier (Optional) --</option>
            <option value="Leopards">Leopards</option>
            <option value="TCS">TCS</option>
            <option value="Call Courier">Call Courier</option>
            <option value="Trax">Trax</option>
            <option value="Other">Other</option>
          </select>
          <input
            type="datetime-local"
            className="h-10 border border-zinc-300 px-3 text-sm"
            placeholder="Estimated Delivery (optional)"
            value={draft.estimatedDelivery}
            onChange={(event) => setDraft((current) => current ? { ...current, estimatedDelivery: event.target.value } : current)}
          />
          <input
            className="h-10 border border-zinc-300 px-3 text-sm"
            placeholder="Internal note (for ops/admin logs)"
            value={draft.note}
            onChange={(event) => setDraft((current) => current ? { ...current, note: event.target.value } : current)}
          />

          {draft.status === "DELIVERY_FAILED" && (
            <>
              <select
                className="h-10 border border-orange-300 bg-orange-50 px-3 text-sm"
                value={draft.failureReason}
                onChange={(event) => setDraft((current) => current ? { ...current, failureReason: event.target.value } : current)}
              >
                <option value="">-- Select failure reason (required) --</option>
                {DELIVERY_FAILURE_REASONS.map((reason) => (
                  <option key={reason.code} value={reason.code}>
                    {reason.label}
                  </option>
                ))}
              </select>

              {draft.failureReason === "OTHER" ? (
                <textarea
                  className="min-h-24 border border-orange-300 bg-orange-50 px-3 py-2 text-sm md:col-span-2"
                  placeholder="Describe the failure reason"
                  value={draft.failureReasonMessage}
                  onChange={(event) => setDraft((current) => current ? { ...current, failureReasonMessage: event.target.value } : current)}
                />
              ) : null}

              <input
                type="datetime-local"
                className="h-10 border border-blue-300 bg-blue-50 px-3 text-sm"
                placeholder="Next attempt date (optional)"
                value={draft.nextAttemptDate}
                onChange={(event) => setDraft((current) => current ? { ...current, nextAttemptDate: event.target.value } : current)}
              />
            </>
          )}
        </div>
      </section>

      <section className="space-y-3 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Items</h2>
        <div className="space-y-3">
          {order.items.map((item) => {
            const isCancelled = order.status === "CANCELED" || cancelledItemIds.has(item.id);
            return (
            <article key={item.id} className={`grid gap-4 border-b py-3 md:grid-cols-[80px_1fr_auto] md:items-center ${isCancelled ? "border-red-100 bg-red-50 px-2" : "border-zinc-200"}`}>
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
                  {isCancelled ? <p className="font-semibold uppercase tracking-[0.12em] text-red-700">Cancelled</p> : null}
                </div>
              </div>
              {isCancelled ? (
                <span className="inline-flex h-9 items-center border border-red-200 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-red-700">
                  Cancelled
                </span>
              ) : (
                <Link href={`/product/${item.product.slug}`} className="inline-flex h-9 items-center border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em] leading-9 text-center">
                  Product
                </Link>
              )}
            </article>
            );
          })}
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
      {openCancelModal ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpenCancelModal(false)}>
          <div className="w-full max-w-xl space-y-5 border border-zinc-300 bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="space-y-1">
              <h3 className="font-heading text-2xl uppercase">Cancel Order</h3>
              <p className="text-sm text-zinc-600">Select items and cancellation reason. This is only allowed before shipment.</p>
            </div>

            <div className="space-y-3">
              {order.items.filter((item) => order.status !== "CANCELED" && !cancelledItemIds.has(item.id)).map((item) => (
                <label key={item.id} className="flex items-center gap-3 border border-zinc-200 p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedCancelItemIds.includes(item.id)}
                    onChange={(event) =>
                      setSelectedCancelItemIds((current) =>
                        event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id),
                      )
                    }
                  />
                  <span className="font-semibold">{item.product.name}</span>
                  <span className="text-zinc-600">x{item.quantity}</span>
                </label>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <select
                className="h-10 border border-zinc-300 bg-white px-3 text-sm"
                value={cancelReasonCode}
                onChange={(event) => setCancelReasonCode(event.target.value as "OUT_OF_STOCK" | "ITEM_DAMAGED")}
              >
                <option value="OUT_OF_STOCK">Out of stock</option>
                <option value="ITEM_DAMAGED">Item damaged</option>
              </select>
              <input
                className="h-10 border border-zinc-300 bg-white px-3 text-sm"
                placeholder="Optional note"
                value={cancelNote}
                onChange={(event) => setCancelNote(event.target.value)}
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button type="button" className="h-10 px-4 text-xs font-bold uppercase tracking-[0.12em] text-zinc-600 hover:text-black" onClick={() => setOpenCancelModal(false)}>
                Close
              </button>
              <button
                type="button"
                className="h-10 border-2 border-black bg-black px-6 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-zinc-800 hover:border-zinc-800 disabled:opacity-50"
                disabled={saving || selectedCancelItemIds.length === 0}
                onClick={() => void applyCancel()}
              >
                {saving ? "Canceling..." : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
