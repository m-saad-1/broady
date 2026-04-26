"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  cancelUserOrder,
  cancelUserSubOrder,
  getMyReviews,
  getUserNotifications,
  getUserOrders,
  reorderUserOrder,
  reorderUserSubOrder,
  type CancelReasonCode,
} from "@/lib/api";
import { formatPkr } from "@/lib/utils";
import { getOrderStatusLabel, getOrderStatusTone } from "@/lib/order-status";
import type { NotificationItem, UserOrder } from "@/types/marketplace";

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

type OrderTrackerClientProps = {
  compact?: boolean;
};

const CANCEL_REASON_OPTIONS: Array<{ code: CancelReasonCode; label: string }> = [
  { code: "CHANGED_MIND", label: "Changed my mind" },
  { code: "ORDERED_BY_MISTAKE", label: "Ordered by mistake" },
  { code: "FOUND_BETTER_PRICE", label: "Found a better price" },
  { code: "DELIVERY_TOO_SLOW", label: "Delivery is taking too long" },
  { code: "PAYMENT_ISSUE", label: "Payment issue" },
  { code: "OTHER", label: "Other" },
];

const CANCEL_RETENTION_MS = 48 * 60 * 60 * 1000;

function canReorderBySubOrders(order: UserOrder) {
  return order.subOrders.length > 0 && order.subOrders.every((subOrder) => ["DELIVERED", "CANCELED"].includes(subOrder.status));
}

export function OrderTrackerClient({ compact = false }: OrderTrackerClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [myReviewsByOrderItemId, setMyReviewsByOrderItemId] = useState<Record<string, { id: string; createdAt: string }>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasAccess, setHasAccess] = useState(true);
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const [cancelingSubOrderId, setCancelingSubOrderId] = useState<string | null>(null);
  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(null);
  const [cancelFeedback, setCancelFeedback] = useState<string>("");
  const [cancelReasonModal, setCancelReasonModal] = useState<{ orderId: string; subOrderId?: string; brandName?: string } | null>(null);
  const [cancelReasonCode, setCancelReasonCode] = useState<CancelReasonCode>("CHANGED_MIND");
  const [cancelCustomReason, setCancelCustomReason] = useState("");
  const [reorderConfirmOrderId, setReorderConfirmOrderId] = useState<string | null>(null);
  const [reorderingSubOrderId, setReorderingSubOrderId] = useState<string | null>(null);
  const [visibleNotificationCount, setVisibleNotificationCount] = useState(5);

  const loadOrders = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const [nextOrders, nextNotifications, myReviews] = await Promise.all([getUserOrders(), getUserNotifications(), getMyReviews(300, 0)]);
      setOrders(nextOrders);
      setNotifications(nextNotifications);
      setMyReviewsByOrderItemId(
        myReviews.reduce<Record<string, { id: string; createdAt: string }>>((accumulator, review) => {
          accumulator[review.orderItemId] = { id: review.id, createdAt: review.createdAt };
          return accumulator;
        }, {}),
      );
      setSelectedOrderId((current) => current || nextOrders[0]?.id || "");
    } catch (error) {
      if (mode === "initial" && error instanceof Error && /(401|403)/.test(error.message)) {
        setHasAccess(false);
      }

      if (mode === "initial") {
        setOrders([]);
        setNotifications([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleCancelOrder = useCallback(async (orderId: string, payload: { reasonCode: CancelReasonCode; customReason?: string }) => {
    setCancelFeedback("");
    setCancelingOrderId(orderId);
    try {
      await cancelUserOrder(orderId, {
        reasonCode: payload.reasonCode,
        customReason: payload.customReason,
        note: "Canceled by customer from account order tracker",
      });
      setCancelFeedback("Order canceled successfully.");
      await loadOrders("refresh");
    } catch (error) {
      setCancelFeedback(error instanceof Error ? error.message : "Unable to cancel this order right now.");
    } finally {
      setCancelingOrderId(null);
    }
  }, [loadOrders]);

  const handleReorder = useCallback(async (orderId: string) => {
    setCancelFeedback("");
    setReorderingOrderId(orderId);
    try {
      await reorderUserOrder(orderId);
      setCancelFeedback("Items from this order were added to your cart.");
      router.push("/cart");
    } catch (error) {
      setCancelFeedback(error instanceof Error ? error.message : "Unable to reorder this order right now.");
    } finally {
      setReorderingOrderId(null);
    }
  }, [router]);

  const handleCancelSubOrder = useCallback(async (orderId: string, subOrderId: string, brandName: string, payload: { reasonCode: CancelReasonCode; customReason?: string }) => {
    setCancelFeedback("");
    setCancelingSubOrderId(subOrderId);
    try {
      await cancelUserSubOrder(orderId, subOrderId, {
        reasonCode: payload.reasonCode,
        customReason: payload.customReason,
        note: `Canceled ${brandName} vendor group by customer`,
      });
      setCancelFeedback(`${brandName} vendor group canceled successfully.`);
      await loadOrders("refresh");
    } catch (error) {
      setCancelFeedback(error instanceof Error ? error.message : "Unable to cancel this vendor group right now.");
    } finally {
      setCancelingSubOrderId(null);
    }
  }, [loadOrders]);

  const handleReorderSubOrder = useCallback(async (orderId: string, subOrderId: string) => {
    setCancelFeedback("");
    setReorderingSubOrderId(subOrderId);
    try {
      await reorderUserSubOrder(orderId, subOrderId);
      setCancelFeedback("Items from this vendor group were added to your cart.");
      router.push("/cart");
    } catch (error) {
      setCancelFeedback(error instanceof Error ? error.message : "Unable to reorder this vendor group right now.");
    } finally {
      setReorderingSubOrderId(null);
    }
  }, [router]);

  useEffect(() => {
    void loadOrders("initial");
    const interval = window.setInterval(() => {
      void loadOrders("refresh");
    }, 30000);

    return () => window.clearInterval(interval);
  }, [loadOrders]);

  useEffect(() => {
    const selectedFromQuery = searchParams.get("orderId") || "";
    if (!selectedFromQuery) return;
    if (!orders.some((order) => order.id === selectedFromQuery)) return;
    setSelectedOrderId(selectedFromQuery);
  }, [orders, searchParams]);

  const visibleOrders = useMemo(
    () =>
      orders.filter((order) => {
        if (order.status !== "CANCELED") return true;
        return Date.now() - new Date(order.updatedAt || order.createdAt).getTime() <= CANCEL_RETENTION_MS;
      }),
    [orders],
  );

  const activeOrders = useMemo(
    () => visibleOrders.filter((order) => !["DELIVERED", "CANCELED"].includes(order.status)),
    [visibleOrders],
  );

  const deliveredOrdersList = useMemo(
    () => visibleOrders.filter((order) => order.status === "DELIVERED"),
    [visibleOrders],
  );

  const canceledOrdersList = useMemo(
    () => visibleOrders.filter((order) => order.status === "CANCELED"),
    [visibleOrders],
  );

  const orderedForSidebar = useMemo(
    () => [...activeOrders, ...deliveredOrdersList, ...canceledOrdersList],
    [activeOrders, deliveredOrdersList, canceledOrdersList],
  );

  const selectedOrder = useMemo(
    () => visibleOrders.find((order) => order.id === selectedOrderId) || visibleOrders[0] || null,
    [visibleOrders, selectedOrderId],
  );

  const selectedNotifications = useMemo(
    () =>
      selectedOrder
        ? notifications.filter((notification) => notification.order?.id === selectedOrder.id)
        : notifications,
    [notifications, selectedOrder],
  );

  const isInActionWindow = !!selectedOrder && Date.now() - new Date(selectedOrder.createdAt).getTime() <= 24 * 60 * 60 * 1000;
  const canCancelSelectedOrder = !!selectedOrder && isInActionWindow && ["PENDING", "CONFIRMED"].includes(selectedOrder.status);
  const canReorderSelectedOrder = !!selectedOrder && canReorderBySubOrders(selectedOrder);

  const visibleSubOrders = useMemo(() => visibleOrders.flatMap((order) => order.subOrders || []), [visibleOrders]);
  const openItems = useMemo(
    () => visibleSubOrders.filter((subOrder) => !["DELIVERED", "CANCELED"].includes(subOrder.status)).length,
    [visibleSubOrders],
  );
  const deliveredItems = useMemo(() => visibleSubOrders.filter((subOrder) => subOrder.status === "DELIVERED").length, [visibleSubOrders]);
  const cancelledItems = useMemo(() => visibleSubOrders.filter((subOrder) => subOrder.status === "CANCELED").length, [visibleSubOrders]);
  const unreadNotifications = useMemo(() => notifications.filter((notification) => !notification.readAt).length, [notifications]);
  const totalSpent = useMemo(
    () => visibleSubOrders.reduce((sum, subOrder) => sum + (subOrder.status === "DELIVERED" ? subOrder.subtotalPkr : 0), 0),
    [visibleSubOrders],
  );
  const sortedNotifications = useMemo(() => {
    return [...selectedNotifications]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, visibleNotificationCount);
  }, [selectedNotifications, visibleNotificationCount]);

  const selectedSubOrderEvents = useMemo(() => {
    if (!selectedOrder) return [];
    return selectedOrder.subOrders
      .flatMap((subOrder) =>
        subOrder.statusLogs.map((log) => ({
          ...log,
          brandName: subOrder.brand?.name || "Brand",
        })),
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [selectedOrder]);

  const deliveredItemIds = useMemo(() => {
    if (!selectedOrder) return new Set<string>();
    return new Set(
      selectedOrder.subOrders
        .filter((subOrder) => subOrder.status === "DELIVERED")
        .flatMap((subOrder) => subOrder.items.map((item) => item.id)),
    );
  }, [selectedOrder]);

  const subOrderByItemId = useMemo(() => {
    if (!selectedOrder) return new Map<string, UserOrder["subOrders"][number]>();
    const mapping = new Map<string, UserOrder["subOrders"][number]>();
    for (const subOrder of selectedOrder.subOrders) {
      for (const item of subOrder.items) {
        mapping.set(item.id, subOrder);
      }
    }
    return mapping;
  }, [selectedOrder]);

  const firstWriteReviewItem = useMemo(() => {
    if (!selectedOrder) return null;
    return selectedOrder.items.find((item) => deliveredItemIds.has(item.id) && !myReviewsByOrderItemId[item.id]) || null;
  }, [deliveredItemIds, myReviewsByOrderItemId, selectedOrder]);

  if (loading) {
    return <p className="text-sm text-zinc-600">Loading your order tracker...</p>;
  }

  if (!hasAccess) {
    return (
      <section className="space-y-3 border border-zinc-300 p-6">
        <div className="flex items-end justify-between gap-4 border-b border-zinc-300 pb-3">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Order Tracking</p>
            <h2 className="font-heading text-3xl uppercase tracking-[0.06em]">Your Orders</h2>
          </div>
        </div>
        <p className="text-sm text-zinc-700">Sign in to view your order history, status updates, and support actions.</p>
        <Link href="/login" className="inline-flex border border-black bg-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">
          Go to login
        </Link>
      </section>
    );
  }

  if (!orders.length) {
    return (
      <section className="space-y-3 border border-zinc-300 p-6">
        <div className="flex items-end justify-between gap-4 border-b border-zinc-300 pb-3">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Order Tracking</p>
            <h2 className="font-heading text-3xl uppercase tracking-[0.06em]">Your Orders</h2>
          </div>
          <button type="button" onClick={() => void loadOrders("refresh")} className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600">
            Refresh
          </button>
        </div>
        <p className="text-sm text-zinc-700">You have no orders yet. Browse the catalog to place your first order.</p>
        <Link href="/catalog" className="inline-flex border border-black bg-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">
          Start shopping
        </Link>
      </section>
    );
  }

  if (compact) {
    return (
      <section className="space-y-4 border border-zinc-300 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-300 pb-3">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Order Snapshot</p>
            <h2 className="font-heading text-3xl uppercase tracking-[0.06em]">Recent Orders</h2>
            <p className="text-sm text-zinc-600">Your latest orders are shown as quick summaries. Open any card for full details.</p>
          </div>
          <Link href="/account/orders" className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600">
            View all orders
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {visibleOrders.map((order) => (
            <Link key={order.id} href={`/account/orders/${order.id}`} className="block border border-zinc-300 p-4 transition hover:border-black hover:bg-zinc-50">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.08em]">Order #{formatShortOrderId(order.id)}</p>
                <p className="text-sm font-semibold">{formatPkr(order.totalPkr)}</p>
              </div>
              <p className="mt-3 text-xs text-zinc-600">{order.items.length} items</p>
              <p className="mt-1 text-xs text-zinc-600">
                {order.items.slice(0, 3).map((item) => item.product.name).join(", ")}
                {order.items.length > 3 ? ` + ${order.items.length - 3} more` : ""}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.12em] text-zinc-500">{formatDateTime(order.createdAt)}</p>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5 border border-zinc-300 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-300 pb-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Order Tracking</p>
          <h2 className="font-heading text-3xl uppercase tracking-[0.06em]">Your Orders</h2>
          <p className="text-sm text-zinc-600">Track order status, review item details, and keep support actions close at hand.</p>
        </div>
        <button type="button" onClick={() => void loadOrders("refresh")} className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600">
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <article className="border border-zinc-200 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Open Items</p>
          <p className="mt-2 font-heading text-3xl">{openItems}</p>
        </article>
        <article className="border border-zinc-200 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Delivered Items</p>
          <p className="mt-2 font-heading text-3xl">{deliveredItems}</p>
        </article>
        <article className="border border-zinc-200 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Cancelled Items</p>
          <p className="mt-2 font-heading text-3xl">{cancelledItems}</p>
        </article>
        <article className="border border-zinc-200 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Total Spent</p>
          <p className="mt-2 font-heading text-3xl">{formatPkr(totalSpent)}</p>
        </article>
      </div>

      <div className="grid gap-3 md:grid-cols-1">
        <article className="border border-zinc-200 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Notifications</p>
          <p className="mt-2 font-heading text-3xl">{unreadNotifications}</p>
        </article>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-3">
          {orderedForSidebar.map((order, index) => {
            const previous = orderedForSidebar[index - 1];
            const startsDeliveredSection = order.status === "DELIVERED" && previous?.status !== "DELIVERED";
            const startsCanceledSection = order.status === "CANCELED" && previous?.status !== "CANCELED";

            return (
              <div key={order.id} className="space-y-2">
                {startsDeliveredSection ? <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Delivered</p> : null}
                {startsCanceledSection ? <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Cancelled</p> : null}
                <Link
                  href={`/account/orders/${order.id}`}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`block w-full border p-4 text-left transition-colors ${selectedOrder?.id === order.id ? "border-black bg-black text-white" : "border-zinc-300"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.08em]">Order #{formatShortOrderId(order.id)}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] opacity-80">{order.items.length} items</p>
                    </div>
                    <p className="text-sm font-semibold">{formatPkr(order.totalPkr)}</p>
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.12em] opacity-80">{formatDateTime(order.createdAt)}</p>
                  <p className="mt-2 text-sm opacity-90">
                    {order.items.slice(0, 3).map((item) => item.product.name).join(", ")}
                    {order.items.length > 3 ? ` + ${order.items.length - 3} more` : ""}
                  </p>
                </Link>
              </div>
            );
          })}
        </aside>

        {selectedOrder ? (
          <div className="space-y-5">
            <section className="grid gap-4 border border-zinc-300 p-5 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Order Reference</p>
                <p className="mt-2 text-lg font-semibold">{selectedOrder.id}</p>
                <p className="mt-1 text-sm text-zinc-600">Placed {formatDateTime(selectedOrder.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Vendor Groups</p>
                <p className="mt-2 text-sm font-semibold">{selectedOrder.subOrders?.length || 0} vendor groups</p>
                <p className="mt-2 text-sm text-zinc-600">Tracking IDs are managed per vendor group card.</p>
                {canCancelSelectedOrder ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCancelReasonModal({
                        orderId: selectedOrder.id,
                      })
                    }
                    disabled={cancelingOrderId === selectedOrder.id}
                    className="mt-3 inline-flex h-10 items-center justify-center border border-black px-3 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cancelingOrderId === selectedOrder.id ? "Canceling..." : "Cancel order"}
                  </button>
                ) : null}
                {canReorderSelectedOrder ? (
                  <button
                    type="button"
                    onClick={() => setReorderConfirmOrderId(selectedOrder.id)}
                    disabled={reorderingOrderId === selectedOrder.id}
                    className="mt-3 ml-2 inline-flex h-10 items-center justify-center border border-zinc-300 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {reorderingOrderId === selectedOrder.id ? "Reordering..." : "Reorder"}
                  </button>
                ) : null}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Payment</p>
                <p className="mt-2 text-sm font-semibold">{selectedOrder.paymentMethod} / {selectedOrder.paymentStatus}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Delivery Address</p>
                <p className="mt-2 text-sm text-zinc-700">{selectedOrder.deliveryAddress}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Order Total</p>
                <p className="mt-2 text-sm font-semibold">{formatPkr(selectedOrder.totalPkr)}</p>
              </div>
            </section>

            {cancelFeedback ? (
              <p className={`border px-3 py-2 text-sm ${cancelFeedback.toLowerCase().includes("success") ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
                {cancelFeedback}
              </p>
            ) : null}

            <section className="space-y-3 border border-zinc-300 p-5">
              <div className="flex items-end justify-between gap-4">
                <h3 className="font-heading text-3xl uppercase">Vendor Groups</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {(selectedOrder.subOrders || []).map((subOrder) => (
                  <article
                    key={subOrder.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/account/orders/${selectedOrder.id}/groups/${subOrder.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/account/orders/${selectedOrder.id}/groups/${subOrder.id}`);
                      }
                    }}
                    className="cursor-pointer border border-zinc-200 p-4 transition hover:border-black hover:bg-zinc-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold uppercase tracking-[0.08em]">{subOrder.brand?.name || "Brand"}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-zinc-500">Group {subOrder.id}</p>
                      </div>
                      <p className={`inline-flex border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${getOrderStatusTone(subOrder.status)}`}>
                        {getOrderStatusLabel(subOrder.status)}
                      </p>
                    </div>

                    <div className="mt-3 space-y-1 text-sm text-zinc-700">
                      <p>{formatPkr(subOrder.subtotalPkr)}</p>
                      <p>{formatDateTime(subOrder.createdAt)}</p>
                      <p className="line-clamp-2 text-xs text-zinc-600">{subOrder.items.slice(0, 2).map((item) => item.product.name).join(", ")} - {subOrder.items.length} Items</p>
                    </div>

                    {isInActionWindow && ["PENDING", "CONFIRMED"].includes(subOrder.status) ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setCancelReasonModal({
                            orderId: selectedOrder.id,
                            subOrderId: subOrder.id,
                            brandName: subOrder.brand?.name || "Brand",
                          });
                        }}
                        disabled={cancelingSubOrderId === subOrder.id}
                        className="mt-3 inline-flex h-9 items-center border border-zinc-300 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cancelingSubOrderId === subOrder.id ? "Canceling..." : "Cancel this group"}
                      </button>
                    ) : null}

                    {["DELIVERED", "CANCELED"].includes(subOrder.status) ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void handleReorderSubOrder(selectedOrder.id, subOrder.id);
                        }}
                        disabled={reorderingSubOrderId === subOrder.id}
                        className="mt-3 ml-2 inline-flex h-9 items-center border border-black bg-black px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {reorderingSubOrderId === subOrder.id ? "Reordering..." : "Reorder"}
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

            <section className="space-y-3 border border-zinc-300 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-heading text-3xl uppercase">Order Items</h3>
                {firstWriteReviewItem ? (
                  <Link href={`/account/reviews?orderItemId=${encodeURIComponent(firstWriteReviewItem.id)}&formOpen=1`} className="inline-flex border border-black bg-black px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                    Write Review
                  </Link>
                ) : null}
              </div>
              <div className="space-y-3">
                {selectedOrder.items.map((item) => (
                  <article key={item.id} className="border border-zinc-200 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold uppercase tracking-[0.08em]">{item.product.name}</p>
                      {(() => {
                        const itemSubOrder = subOrderByItemId.get(item.id);
                        const canCancelItemSubOrder =
                          Boolean(itemSubOrder) &&
                          isInActionWindow &&
                          ["PENDING", "CONFIRMED"].includes(itemSubOrder!.status);

                        if (!canCancelItemSubOrder || !itemSubOrder || !selectedOrder) return null;

                        return (
                          <button
                            type="button"
                            onClick={() =>
                              setCancelReasonModal({
                                orderId: selectedOrder.id,
                                subOrderId: itemSubOrder.id,
                                brandName: itemSubOrder.brand?.name || "Brand",
                              })
                            }
                            disabled={cancelingSubOrderId === itemSubOrder.id}
                            className="inline-flex border border-zinc-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {cancelingSubOrderId === itemSubOrder.id ? "Canceling..." : "Cancel Item Group"}
                          </button>
                        );
                      })()}
                      {deliveredItemIds.has(item.id) ? (
                        myReviewsByOrderItemId[item.id] ? (
                          <div className="flex flex-wrap gap-2">
                            <Link href={`/account/reviews?reviewId=${encodeURIComponent(myReviewsByOrderItemId[item.id].id)}`} className="inline-flex border border-zinc-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
                              View Review
                            </Link>
                            {Date.now() - new Date(myReviewsByOrderItemId[item.id].createdAt).getTime() <= 10 * 60 * 1000 ? (
                              <Link href={`/account/reviews?editReviewId=${encodeURIComponent(myReviewsByOrderItemId[item.id].id)}`} className="inline-flex border border-black bg-black px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                                Edit Review
                              </Link>
                            ) : null}
                          </div>
                        ) : (
                          <Link href={`/account/reviews?orderItemId=${encodeURIComponent(item.id)}&formOpen=1`} className="inline-flex border border-black bg-black px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                            Write Review
                          </Link>
                        )
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-700">
                      <p className="font-semibold">Size: {item.selectedSize || "Not specified"}</p>
                      <p className="font-semibold">Color: {item.selectedColor || "Not specified"}</p>
                      <p className="font-semibold">Quantity: {item.quantity}</p>
                      <p className="font-semibold">Price: {formatPkr(item.unitPricePkr)}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="space-y-3 border border-zinc-300 p-5">
              <h3 className="font-heading text-3xl uppercase">Vendor Group Events</h3>
              <div className="space-y-3">
                {selectedSubOrderEvents.map((log) => (
                  <article key={log.id} className="border border-zinc-200 p-3 text-sm">
                    <p className="font-semibold uppercase tracking-[0.08em]">{log.brandName} - {getOrderStatusLabel(log.status)}</p>
                    <p className="text-zinc-600">
                      {log.updatedBy}
                      {log.note ? ` - ${log.note}` : ""}
                    </p>
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{formatDateTime(log.createdAt)}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="space-y-4 border border-zinc-300 p-5">
              <h3 className="font-heading text-3xl uppercase">Support</h3>
              <p className="text-sm text-zinc-700">Need help with this order? Contact support with the order reference attached.</p>
              <div className="flex flex-wrap gap-2">
                <a href={`mailto:support@broady.pk?subject=Support%20request%20for%20order%20${selectedOrder.id}`} className="inline-flex h-11 items-center justify-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                  Contact support
                </a>
                <Link href="/offers" className="inline-flex h-11 items-center justify-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
                  Help & offers
                </Link>
              </div>
            </section>

            {selectedNotifications.length > 0 ? (
              <section className="space-y-3 border border-zinc-300 p-5">
                <div className="flex items-end justify-between gap-4">
                  <h3 className="font-heading text-3xl uppercase">Notifications</h3>
                  <Link href="/account/notifications" className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600">
                    View all
                  </Link>
                </div>
                <div className="space-y-3">
                  {sortedNotifications.map((notification) => (
                    <article key={notification.id} className="border border-zinc-200 p-3 text-sm">
                      <p className="font-semibold uppercase tracking-[0.08em]">{notification.title}</p>
                      <p className="text-zinc-600">{notification.message}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-zinc-500">{formatDateTime(notification.createdAt)}</p>
                    </article>
                  ))}
                </div>
                {selectedNotifications.length > visibleNotificationCount ? (
                  <button
                    type="button"
                    onClick={() => setVisibleNotificationCount((current) => current + 5)}
                    className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]"
                  >
                    Load More
                  </button>
                ) : null}
              </section>
            ) : null}
          </div>
        ) : null}
      </div>

      {cancelReasonModal ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={() => setCancelReasonModal(null)}>
          <div className="w-full max-w-md space-y-4 border border-zinc-300 bg-white p-5" onClick={(event) => event.stopPropagation()}>
            <h3 className="font-heading text-2xl uppercase">Cancel {cancelReasonModal.subOrderId ? "Vendor Group" : "Order"}</h3>
            <p className="text-sm text-zinc-600">Choose a reason before canceling.</p>

            <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-zinc-500">
              Reason
              <select
                className="h-10 w-full border border-zinc-300 px-3 text-sm text-zinc-900"
                value={cancelReasonCode}
                onChange={(event) => setCancelReasonCode(event.target.value as CancelReasonCode)}
              >
                {CANCEL_REASON_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {cancelReasonCode === "OTHER" ? (
              <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-zinc-500">
                Custom Reason
                <textarea
                  className="min-h-20 w-full border border-zinc-300 p-2 text-sm text-zinc-900"
                  placeholder="Tell us why you are canceling"
                  value={cancelCustomReason}
                  onChange={(event) => setCancelCustomReason(event.target.value)}
                />
              </label>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button type="button" className="h-10 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]" onClick={() => setCancelReasonModal(null)}>
                Keep
              </button>
              <button
                type="button"
                className="h-10 border border-black bg-black px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                disabled={cancelReasonCode === "OTHER" && !cancelCustomReason.trim()}
                onClick={() => {
                  if (!cancelReasonModal) return;
                  const payload = {
                    reasonCode: cancelReasonCode,
                    customReason: cancelReasonCode === "OTHER" ? cancelCustomReason.trim() : undefined,
                  };
                  if (cancelReasonModal.subOrderId) {
                    void handleCancelSubOrder(
                      cancelReasonModal.orderId,
                      cancelReasonModal.subOrderId,
                      cancelReasonModal.brandName || "Brand",
                      payload,
                    );
                  } else {
                    void handleCancelOrder(cancelReasonModal.orderId, payload);
                  }
                  setCancelReasonModal(null);
                  setCancelReasonCode("CHANGED_MIND");
                  setCancelCustomReason("");
                }}
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={Boolean(reorderConfirmOrderId)}
        title="Reorder Items"
        description="Reorder will add available items from this order to your cart. Continue?"
        confirmText="Yes, reorder"
        cancelText="Not now"
        onCancel={() => setReorderConfirmOrderId(null)}
        onConfirm={() => {
          if (!reorderConfirmOrderId) return;
          void handleReorder(reorderConfirmOrderId);
          setReorderConfirmOrderId(null);
        }}
      />
    </section>
  );
}
