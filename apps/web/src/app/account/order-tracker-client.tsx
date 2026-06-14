"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getTrackingUrl } from "@broady/shared";
import { ProductImage } from "@/components/ui/product-image";
import { getUserOrders, reorderUserSubOrder } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media-url";
import { getCancelledOrderItemIds } from "@/lib/order-cancellation";
import { getOrderStatusLabel, getOrderStatusTone } from "@/lib/order-status";
import {
  formatOperatorReturnStatus,
  formatReturnReasonLabel,
  getDisplayReturnStatus,
  getReturnRequestItems,
  getReturnRequestType,
} from "@/lib/return-workflow";
import { formatPkr } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import type { UserOrder } from "@/types/marketplace";

type OrderTrackerClientProps = {
  compact?: boolean;
};

type MainTab = "OPEN" | "DELIVERED" | "RETURNS" | "EXCHANGE" | "CANCELED";

type RequestListItem = NonNullable<UserOrder["subOrders"][number]["returnRequests"]>[number] & {
  order: UserOrder;
  subOrder: UserOrder["subOrders"][number];
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatShortOrderId(orderId: string) {
  if (!orderId) return "";
  if (orderId.length <= 16) return orderId;
  return `${orderId.slice(0, 8)}...${orderId.slice(-4)}`;
}

export function OrderTrackerClient({ compact = false }: OrderTrackerClientProps) {
  const router = useRouter();
  const setCartItems = useCartStore((state) => state.setItems);

  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasAccess, setHasAccess] = useState(true);
  const [reorderingSubOrderId, setReorderingSubOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>("OPEN");

  const loadOrders = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);

    try {
      const nextOrders = await getUserOrders();
      setOrders(nextOrders);
      setHasAccess(true);
    } catch (error) {
      if (mode === "initial" && error instanceof Error && /(401|403)/.test(error.message)) {
        setHasAccess(false);
      }
      if (mode === "initial") {
        setOrders([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const displayedOrders = useMemo(() => {
    const getVisibleItems = (group: UserOrder["subOrders"][number]) => {
      const cancelledIds = getCancelledOrderItemIds(group.statusLogs);
      if (group.status === "CANCELED") return activeTab === "CANCELED" ? group.items : [];
      if (activeTab === "CANCELED") return group.items.filter((item) => cancelledIds.has(item.id));
      if (activeTab === "OPEN") {
        if (["DELIVERED", "CANCELED", "RETURNED", "SHIPMENT_RETURNED"].includes(group.status)) return [];
        return group.items.filter((item) => !cancelledIds.has(item.id));
      }
      if (activeTab === "DELIVERED") {
        return group.status === "DELIVERED" ? group.items.filter((item) => !cancelledIds.has(item.id)) : [];
      }
      return [];
    };

    const matchesTab = (group: UserOrder["subOrders"][number]) => {
      if (activeTab === "CANCELED") {
        return group.status === "CANCELED" || getCancelledOrderItemIds(group.statusLogs).size > 0;
      }
      if (activeTab === "OPEN") {
        return !["DELIVERED", "CANCELED", "RETURNED", "SHIPMENT_RETURNED"].includes(group.status) && getVisibleItems(group).length > 0;
      }
      if (activeTab === "DELIVERED") return group.status === "DELIVERED";
      return false;
    };

    return orders
      .map((order) => ({
        order,
        groups: (order.subOrders || [])
          .filter((group) => matchesTab(group))
          .map((group) => ({
            ...group,
            visibleItems: getVisibleItems(group),
            cancelledItemIds: getCancelledOrderItemIds(group.statusLogs),
          })),
      }))
      .filter((entry) => entry.groups.length > 0)
      .sort((a, b) => new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime());
  }, [orders, activeTab]);

  const displayedRequests = useMemo(() => {
    if (activeTab !== "RETURNS" && activeTab !== "EXCHANGE") return [] as Array<{ order: UserOrder; requests: RequestListItem[] }>;

    const requestType = activeTab === "RETURNS" ? "RETURN" : "EXCHANGE";

    return orders
      .map((order) => ({
        order,
        requests: (order.subOrders || [])
          .flatMap((subOrder) =>
            (subOrder.returnRequests || [])
              .filter((request) => getReturnRequestType(request) === requestType)
              .map((request) => ({ ...request, order, subOrder })),
          )
          .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()),
      }))
      .filter((entry) => entry.requests.length > 0)
      .sort((a, b) => new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime());
  }, [activeTab, orders]);

  const handleReorderSubOrder = useCallback(
    async (orderId: string, subOrderId: string) => {
      setReorderingSubOrderId(subOrderId);
      try {
        const result = await reorderUserSubOrder(orderId, subOrderId);
        setCartItems(
          result.items.map((item) => ({
            product: item.product,
            quantity: item.quantity,
            selectedColor: item.selectedColor || undefined,
            selectedSize: item.selectedSize || undefined,
          })),
        );
        router.push("/cart");
      } finally {
        setReorderingSubOrderId(null);
      }
    },
    [router, setCartItems],
  );

  useEffect(() => {
    void loadOrders("initial");
  }, [loadOrders]);

  if (loading) {
    return <p className="text-sm text-zinc-600">Loading your order tracker...</p>;
  }

  if (!hasAccess) {
    return (
      <section className="space-y-3 border border-zinc-300 p-6">
        <p className="text-sm text-zinc-700">Sign in to view your order history.</p>
        <Link href="/login" className="inline-flex border border-black bg-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">
          Go to login
        </Link>
      </section>
    );
  }

  if (!orders.length) {
    return (
      <section className="space-y-3 border border-zinc-300 p-6">
        <p className="text-sm text-zinc-700">You have no orders yet.</p>
        <Link href="/catalog" className="inline-flex border border-black bg-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">
          Start shopping
        </Link>
      </section>
    );
  }

  if (compact) {
    return (
      <section className="space-y-4 border border-zinc-300 p-6">
        <div className="grid gap-3 md:grid-cols-2">
          {orders.map((order) => (
            <Link key={order.id} href={`/account/orders?orderId=${order.id}`} className="block border border-zinc-300 p-4 transition hover:border-black hover:bg-zinc-50">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.08em]">Order #{formatShortOrderId(order.id)}</p>
                <p className="text-sm font-semibold">{formatPkr(order.totalPkr)}</p>
              </div>
              <p className="mt-3 text-xs text-zinc-600">{order.items.length} items</p>
              <p className="mt-3 text-xs uppercase tracking-[0.12em] text-zinc-500">{formatDateTime(order.createdAt)}</p>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-300 pb-3">
        <div className="space-y-1">
          <h2 className="font-heading text-3xl uppercase tracking-[0.06em]">Orders & Tracking</h2>
          <p className="text-sm text-zinc-600">Track active orders, deliveries, returns, and exchanges from one place.</p>
        </div>
        <button type="button" onClick={() => void loadOrders("refresh")} className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600">
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-200">
        {(["OPEN", "DELIVERED", "RETURNS", "EXCHANGE", "CANCELED"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
              activeTab === tab ? "border-black text-black" : "border-transparent text-zinc-500 hover:text-black"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "RETURNS" || activeTab === "EXCHANGE" ? (
        displayedRequests.length === 0 ? (
          <div className="border border-zinc-300 bg-zinc-50 p-8 text-center">
            <p className="text-sm text-zinc-600">No {activeTab.toLowerCase()} requests found.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {displayedRequests.map(({ order, requests }) => (
              <article key={order.id} className="border border-zinc-300 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-200 pb-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.08em]">Order #{formatShortOrderId(order.id)}</p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {formatDateTime(order.createdAt)} | {requests.length} request(s)
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatPkr(order.totalPkr)}</p>
                </div>

                <div className="mt-4 space-y-3">
                  {requests.map((request) => {
                    const requestType = getReturnRequestType(request);
                    const displayStatus = getDisplayReturnStatus(request);
                    const requestItems = getReturnRequestItems({
                      orderItemIds: request.orderItemIds,
                      subOrder: { items: request.subOrder.items },
                    });
                    const requestPath =
                      requestType === "EXCHANGE"
                        ? `/account/orders/${order.id}/groups/${request.subOrder.id}/exchange/${request.id}`
                        : `/account/orders/${order.id}/groups/${request.subOrder.id}/return/${request.id}`;

                    return (
                      <section key={request.id} className="border border-zinc-200 p-3">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.1em]">{request.subOrder.brand?.name || "Brand"}</p>
                            <p className="mt-1 text-xs text-zinc-600">Request ID: {request.id}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <p className="inline-flex border border-zinc-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-700">
                              {requestType === "EXCHANGE" ? "Exchange" : "Return"}
                            </p>
                            <p className="inline-flex border border-zinc-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-700">
                              {formatOperatorReturnStatus(displayStatus, requestType)}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {requestItems.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 border border-zinc-100 p-2">
                              <div className="relative h-14 w-12 flex-none overflow-hidden border border-zinc-200 bg-zinc-50">
                                <ProductImage
                                  src={resolveMediaUrl(item.product?.imageUrl)}
                                  alt={item.product?.name || "Product"}
                                  fill
                                  sizes="48px"
                                  className="object-cover"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold">{item.product?.name}</p>
                                <p className="mt-1 text-[11px] text-zinc-600">
                                  Color: {item.selectedColor || "N/A"} | Size: {item.selectedSize || "N/A"}
                                </p>
                              </div>
                              <p className="text-xs font-semibold">{formatPkr(item.unitPricePkr || 0)}</p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 space-y-1 text-xs text-zinc-600">
                          <p>Reason: {formatReturnReasonLabel(request.reasonCode, request.reasonText)}</p>
                          {request.customerNote ? <p>Note: {request.customerNote}</p> : null}
                          <p>Submitted: {formatDateTime(request.createdAt)}</p>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Link href={requestPath} className="inline-flex h-8 items-center border border-black bg-black px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                            Open Details
                          </Link>
                          <button
                            type="button"
                            onClick={() => router.push(requestPath)}
                            className="h-8 border border-zinc-300 px-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
                          >
                            Track Request
                          </button>
                        </div>
                      </section>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )
      ) : displayedOrders.length === 0 ? (
        <div className="border border-zinc-300 bg-zinc-50 p-8 text-center">
          <p className="text-sm text-zinc-600">No {activeTab.toLowerCase()} items found.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {displayedOrders.map(({ order, groups }) => (
            <article key={order.id} className="border border-zinc-300 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-200 pb-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.08em]">Order #{formatShortOrderId(order.id)}</p>
                  <p className="mt-1 text-xs text-zinc-600">{formatDateTime(order.createdAt)} | {groups.length} brand group(s)</p>
                </div>
                <p className="text-sm font-semibold">{formatPkr(order.totalPkr)}</p>
              </div>

              <div className="mt-4 space-y-3">
                {groups.map((subOrder) => (
                  <section key={subOrder.id} className="border border-zinc-200 p-3">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em]">{subOrder.brand?.name || "Brand"}</p>
                      <p className={`inline-flex border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${getOrderStatusTone(subOrder.status)}`}>
                        {getOrderStatusLabel(subOrder.status)}
                      </p>
                    </div>

                    <div className="space-y-2">
                      {subOrder.visibleItems.map((item) => {
                        const isCancelled = subOrder.status === "CANCELED" || subOrder.cancelledItemIds.has(item.id);
                        return (
                          <div key={item.id} className={`flex items-center gap-3 border p-2 ${isCancelled ? "border-red-100 bg-red-50" : "border-zinc-100"}`}>
                            <div className="relative h-14 w-12 flex-none overflow-hidden border border-zinc-200 bg-zinc-50">
                              <ProductImage
                                src={resolveMediaUrl(item.product?.imageUrl)}
                                alt={item.product?.name || "Product"}
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold">{item.product?.name}</p>
                              <p className="mt-1 text-[11px] text-zinc-600">
                                Color: {item.selectedColor || "N/A"} | Size: {item.selectedSize || "N/A"}
                              </p>
                            </div>
                            {isCancelled ? <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-red-700">Cancelled</span> : null}
                            <p className="text-xs font-semibold">{formatPkr(item.unitPricePkr)}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => router.push(`/account/orders/${subOrder.orderId}/groups/${subOrder.id}`)} className="h-8 border border-black bg-black px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                        Open Tracking
                      </button>
                      {["CANCELED", "RETURNED", "SHIPMENT_RETURNED"].includes(subOrder.status) || subOrder.refundProcessedAt ? (
                        <button type="button" onClick={() => router.push(`/account/orders/${subOrder.orderId}/groups/${subOrder.id}/refund`)} className="h-8 border border-zinc-300 px-3 text-[10px] font-semibold uppercase tracking-[0.12em]">
                          Refund Tracking
                        </button>
                      ) : null}
                      {subOrder.trackingId && subOrder.courierName && getTrackingUrl(subOrder.courierName, subOrder.trackingId) ? (
                        <a href={getTrackingUrl(subOrder.courierName, subOrder.trackingId) || undefined} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center border border-emerald-600 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                          Track Shipment
                        </a>
                      ) : null}
                      <a href={`mailto:support@broady.local?subject=Support%20for%20order%20${subOrder.orderId}`} className="inline-flex h-8 items-center border border-zinc-300 px-3 text-[10px] font-semibold uppercase tracking-[0.12em]">
                        Contact
                      </a>
                      {["DELIVERED", "CANCELED", "RETURNED"].includes(subOrder.status) ? (
                        <button type="button" onClick={() => void handleReorderSubOrder(subOrder.orderId, subOrder.id)} disabled={reorderingSubOrderId === subOrder.id} className="h-8 border border-zinc-300 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50">
                          {reorderingSubOrderId === subOrder.id ? "Reordering..." : "Reorder"}
                        </button>
                      ) : null}
                    </div>
                  </section>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
