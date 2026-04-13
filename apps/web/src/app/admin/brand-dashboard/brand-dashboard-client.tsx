"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { approveProduct, getAdminBrandDashboard, rejectProduct, updateAdminOrderStatus } from "@/lib/api";
import { getOrderStatusOptions } from "@/lib/order-status";
import { useToastStore } from "@/stores/toast-store";
import type { AdminBrandDashboardRecord, OrderStatus } from "@/types/marketplace";

export function AdminBrandDashboardClient() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [entries, setEntries] = useState<AdminBrandDashboardRecord[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [orderDrafts, setOrderDrafts] = useState<Record<string, { status: OrderStatus; trackingId: string; note: string; customerNote: string }>>({});
  const [pendingStatusOrderId, setPendingStatusOrderId] = useState<string | null>(null);

  const loadData = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const next = await getAdminBrandDashboard();
      setEntries(next);
      setSelectedBrandId((current) => current || next[0]?.brand.id || "");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load brand dashboard";
      pushToast(message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadData("initial");
  }, [loadData]);

  const selected = useMemo(
    () => entries.find((entry) => entry.brand.id === selectedBrandId) || entries[0] || null,
    [entries, selectedBrandId],
  );

  useEffect(() => {
    if (!selected) {
      setOrderDrafts({});
      return;
    }

    const drafts: Record<string, { status: OrderStatus; trackingId: string; note: string; customerNote: string }> = {};
    for (const order of selected.orders) {
      drafts[order.id] = {
        status: order.status,
        trackingId: order.trackingId || "",
        note: "",
        customerNote: "",
      };
    }
    setOrderDrafts(drafts);
  }, [selected]);

  const applyOrderUpdate = async (orderId: string) => {
    const draft = orderDrafts[orderId];
    if (!draft) return;

    setSavingOrderId(orderId);
    try {
      await updateAdminOrderStatus(orderId, {
        status: draft.status,
        trackingId: draft.trackingId.trim() || undefined,
        note: draft.note.trim() || undefined,
        customerNote: draft.customerNote.trim() || undefined,
      });
      pushToast("Order status updated", "success");
      await loadData("refresh");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update order";
      pushToast(message, "error");
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleApproveProduct = async (productId: string) => {
    setSavingProductId(productId);
    try {
      await approveProduct(productId);
      pushToast("Product approved", "success");
      await loadData("refresh");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to approve product";
      pushToast(message, "error");
    } finally {
      setSavingProductId(null);
    }
  };

  const handleRejectProduct = async (productId: string) => {
    setSavingProductId(productId);
    try {
      await rejectProduct(productId, "Rejected by Broady admin dashboard");
      pushToast("Product rejected", "success");
      await loadData("refresh");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reject product";
      pushToast(message, "error");
    } finally {
      setSavingProductId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-600">Loading admin brand dashboard...</p>;
  }

  if (!entries.length) {
    return <p className="border border-zinc-300 p-4 text-sm text-zinc-700">No brands available yet.</p>;
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-4">
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Brands</p>
          <p className="mt-3 font-heading text-4xl">{entries.length}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Products</p>
          <p className="mt-3 font-heading text-4xl">{entries.reduce((acc, item) => acc + item.metrics.totalProducts, 0)}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Orders</p>
          <p className="mt-3 font-heading text-4xl">{entries.reduce((acc, item) => acc + item.metrics.totalOrders, 0)}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Live Updates</p>
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.08em] text-zinc-700">
            {refreshing ? "Refreshing..." : "On demand"}
          </p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-3 border border-zinc-300 p-4">
          <h2 className="font-heading text-3xl uppercase">Brands</h2>
          {entries.map((entry) => (
            <button
              key={entry.brand.id}
              type="button"
              onClick={() => setSelectedBrandId(entry.brand.id)}
              className={`w-full border p-3 text-left ${selected?.brand.id === entry.brand.id ? "border-black bg-black text-white" : "border-zinc-300"}`}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.08em]">{entry.brand.name}</p>
              <p className="text-xs opacity-80">{entry.brand.slug}</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.08em]">
                {entry.metrics.totalProducts} products / {entry.metrics.totalOrders} orders
              </p>
            </button>
          ))}
        </aside>

        {selected ? (
          <div className="space-y-6">
            <section className="space-y-3 border border-zinc-300 p-4">
              <h2 className="font-heading text-3xl uppercase">{selected.brand.name}</h2>
              <p className="text-sm text-zinc-600">{selected.brand.description || "No description provided"}</p>
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <p><span className="font-semibold">Email:</span> {selected.brand.contactEmail || "-"}</p>
                <p><span className="font-semibold">Whatsapp:</span> {selected.brand.whatsappNumber || "-"}</p>
                <p><span className="font-semibold">Commission:</span> {selected.brand.commissionRate}%</p>
              </div>
              <div className="grid gap-3 text-xs uppercase tracking-[0.12em] text-zinc-600 md:grid-cols-4">
                <p>Total products: {selected.metrics.totalProducts}</p>
                <p>Pending products: {selected.metrics.pendingProducts}</p>
                <p>Total orders: {selected.metrics.totalOrders}</p>
                <p>Gross: PKR {selected.metrics.grossPkr.toLocaleString()}</p>
              </div>
            </section>

            <section className="space-y-3 border border-zinc-300 p-4">
              <h3 className="font-heading text-3xl uppercase">Products</h3>
              <div className="space-y-3">
                {selected.products.map((product) => (
                  <article key={product.id} className="space-y-3 border border-zinc-200 p-3">
                    <div className="grid gap-3 md:grid-cols-[80px_2fr_1fr_1fr] md:items-center">
                    <div className="relative h-16 w-16 overflow-hidden border border-zinc-200">
                      <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.08em]">{product.name}</p>
                      <p className="text-xs text-zinc-600">{product.topCategory} / {product.subCategory}</p>
                      <p className="mt-1 text-xs text-zinc-600 line-clamp-2">{product.description}</p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.08em]">
                      {product.approvalStatus || "APPROVED"} / {product.isActive ? "ACTIVE" : "HIDDEN"}
                    </p>
                    <p className="text-sm font-semibold">Stock {product.stock}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.12em]">
                      <span className="border border-zinc-300 px-2 py-1">{product.slug}</span>
                      <span className="border border-zinc-300 px-2 py-1">Sizes: {product.sizes.join(", ")}</span>
                      <span className="border border-zinc-300 px-2 py-1">PKR {product.pricePkr.toLocaleString()}</span>
                      {product.approvalStatus === "PENDING" ? (
                        <>
                          <button type="button" onClick={() => void handleApproveProduct(product.id)} disabled={savingProductId === product.id} className="border border-black bg-black px-3 py-1 text-white disabled:opacity-50">Approve</button>
                          <button type="button" onClick={() => void handleRejectProduct(product.id)} disabled={savingProductId === product.id} className="border border-zinc-300 px-3 py-1 disabled:opacity-50">Reject</button>
                        </>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="space-y-3 border border-zinc-300 p-4">
              <h3 className="font-heading text-3xl uppercase">Orders</h3>
              <div className="space-y-3">
                {selected.orders.map((order) => (
                  <article key={order.id} className="space-y-3 border border-zinc-200 p-3">
                    <div className="grid gap-3 md:grid-cols-[1.5fr_1.2fr_1fr_1fr] md:items-center">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.08em]">Order {order.id.slice(0, 10)}...</p>
                        <p className="text-xs text-zinc-600">{order.user.fullName} / {order.user.email}</p>
                      </div>
                      <p className="text-sm">PKR {order.totalPkr.toLocaleString()}</p>
                      <select
                        value={orderDrafts[order.id]?.status || order.status}
                        onChange={(event) => {
                          const value = event.target.value as OrderStatus;
                          setOrderDrafts((current) => ({
                            ...current,
                            [order.id]: {
                              status: value,
                              trackingId: current[order.id]?.trackingId || order.trackingId || "",
                              note: current[order.id]?.note || "",
                              customerNote: current[order.id]?.customerNote || "",
                            },
                          }));
                        }}
                        className="h-9 border border-zinc-300 px-2 text-xs"
                      >
                        {getOrderStatusOptions(order.status).map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setPendingStatusOrderId(order.id)}
                        disabled={savingOrderId === order.id}
                        className="h-9 border border-black bg-black px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                      >
                        {savingOrderId === order.id ? "Saving" : "Update"}
                      </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        className="h-9 border border-zinc-300 px-3 text-xs"
                        placeholder="Tracking ID"
                        value={orderDrafts[order.id]?.trackingId || ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setOrderDrafts((current) => ({
                            ...current,
                            [order.id]: {
                              status: current[order.id]?.status || order.status,
                              trackingId: value,
                              note: current[order.id]?.note || "",
                              customerNote: current[order.id]?.customerNote || "",
                            },
                          }));
                        }}
                      />
                      <input
                        className="h-9 border border-zinc-300 px-3 text-xs"
                        placeholder="Internal note"
                        value={orderDrafts[order.id]?.note || ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setOrderDrafts((current) => ({
                            ...current,
                            [order.id]: {
                              status: current[order.id]?.status || order.status,
                              trackingId: current[order.id]?.trackingId || order.trackingId || "",
                              note: value,
                              customerNote: current[order.id]?.customerNote || "",
                            },
                          }));
                        }}
                      />
                      <input
                        className="h-9 border border-zinc-300 px-3 text-xs md:col-span-2"
                        placeholder="Customer-visible note"
                        value={orderDrafts[order.id]?.customerNote || ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setOrderDrafts((current) => ({
                            ...current,
                            [order.id]: {
                              status: current[order.id]?.status || order.status,
                              trackingId: current[order.id]?.trackingId || order.trackingId || "",
                              note: current[order.id]?.note || "",
                              customerNote: value,
                            },
                          }));
                        }}
                      />
                    </div>
                    <p className="text-xs text-zinc-600">
                      Items: {order.items.map((item) => `${item.product.name} x${item.quantity}`).join(", ")}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </section>

      <ConfirmModal
        open={Boolean(pendingStatusOrderId)}
        title="Confirm Status Update"
        description={(() => {
          if (!pendingStatusOrderId || !selected) return "";
          const targetOrder = selected.orders.find((order) => order.id === pendingStatusOrderId);
          const draft = targetOrder ? orderDrafts[targetOrder.id] : undefined;
          if (!targetOrder || !draft) return "";
          return `Order ${targetOrder.id.slice(0, 10)}... (${targetOrder.user.fullName}) will be updated to ${draft.status}${draft.trackingId ? ` with tracking ${draft.trackingId}` : ""}.`;
        })()}
        confirmText="Confirm update"
        cancelText="Review again"
        onCancel={() => setPendingStatusOrderId(null)}
        onConfirm={() => {
          if (!pendingStatusOrderId) return;
          void applyOrderUpdate(pendingStatusOrderId);
          setPendingStatusOrderId(null);
        }}
      />
    </div>
  );
}
