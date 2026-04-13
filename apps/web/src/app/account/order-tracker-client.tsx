"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { cancelUserOrder, getUserNotifications, getUserOrders } from "@/lib/api";
import { formatPkr } from "@/lib/utils";
import { getOrderStatusLabel, getOrderStatusTone } from "@/lib/order-status";
import type { NotificationItem, UserOrder } from "@/types/marketplace";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const timelineStatuses: Array<UserOrder["status"]> = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELED"];

type OrderTrackerClientProps = {
  compact?: boolean;
};

export function OrderTrackerClient({ compact = false }: OrderTrackerClientProps) {
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasAccess, setHasAccess] = useState(true);
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const [cancelFeedback, setCancelFeedback] = useState<string>("");
  const [cancelConfirmOrderId, setCancelConfirmOrderId] = useState<string | null>(null);

  const loadOrders = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const [nextOrders, nextNotifications] = await Promise.all([getUserOrders(), getUserNotifications()]);
      setOrders(nextOrders);
      setNotifications(nextNotifications);
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

  const handleCancelOrder = useCallback(async (orderId: string) => {
    setCancelFeedback("");
    setCancelingOrderId(orderId);
    try {
      await cancelUserOrder(orderId, "Canceled by customer from account order tracker");
      setCancelFeedback("Order canceled successfully.");
      await loadOrders("refresh");
    } catch (error) {
      setCancelFeedback(error instanceof Error ? error.message : "Unable to cancel this order right now.");
    } finally {
      setCancelingOrderId(null);
    }
  }, [loadOrders]);

  useEffect(() => {
    void loadOrders("initial");
    const interval = window.setInterval(() => {
      void loadOrders("refresh");
    }, 30000);

    return () => window.clearInterval(interval);
  }, [loadOrders]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) || orders[0] || null,
    [orders, selectedOrderId],
  );

  const selectedNotifications = useMemo(
    () =>
      selectedOrder
        ? notifications.filter((notification) => notification.order?.id === selectedOrder.id)
        : notifications,
    [notifications, selectedOrder],
  );

  const canCancelSelectedOrder = !!selectedOrder && ["PENDING", "CONFIRMED"].includes(selectedOrder.status);

  const openOrders = useMemo(
    () => orders.filter((order) => !["DELIVERED", "CANCELED"].includes(order.status)).length,
    [orders],
  );

  const deliveredOrders = useMemo(() => orders.filter((order) => order.status === "DELIVERED").length, [orders]);
  const unreadNotifications = useMemo(() => notifications.filter((notification) => !notification.readAt).length, [notifications]);
  const totalSpent = useMemo(() => orders.reduce((sum, order) => sum + order.totalPkr, 0), [orders]);
  const recentNotifications = useMemo(() => {
    return [...selectedNotifications]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [selectedNotifications]);

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
          {orders.map((order) => (
            <Link key={order.id} href={`/account/orders/${order.id}`} className="block border border-zinc-300 p-4 transition hover:border-black hover:bg-zinc-50">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.08em]">Order {order.id.slice(0, 10)}...</p>
                <p className="text-sm font-semibold">{formatPkr(order.totalPkr)}</p>
              </div>
              <p className={`mt-3 inline-flex border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${getOrderStatusTone(order.status)}`}>
                {getOrderStatusLabel(order.status)}
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
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Open Orders</p>
          <p className="mt-2 font-heading text-3xl">{openOrders}</p>
        </article>
        <article className="border border-zinc-200 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Delivered</p>
          <p className="mt-2 font-heading text-3xl">{deliveredOrders}</p>
        </article>
        <article className="border border-zinc-200 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Notifications</p>
          <p className="mt-2 font-heading text-3xl">{unreadNotifications}</p>
        </article>
        <article className="border border-zinc-200 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Total Spent</p>
          <p className="mt-2 font-heading text-3xl">{formatPkr(totalSpent)}</p>
        </article>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-3">
          {orders.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => setSelectedOrderId(order.id)}
              className={`w-full border p-4 text-left transition-colors ${selectedOrder?.id === order.id ? "border-black bg-black text-white" : "border-zinc-300"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.08em]">Order {order.id.slice(0, 10)}...</p>
                  <p className={`mt-2 inline-flex border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${selectedOrder?.id === order.id ? "border-white/30 bg-white/10 text-white" : getOrderStatusTone(order.status)}`}>{getOrderStatusLabel(order.status)}</p>
                </div>
                <p className="text-sm font-semibold">{formatPkr(order.totalPkr)}</p>
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.12em] opacity-80">{formatDateTime(order.createdAt)}</p>
              <p className="mt-2 text-sm opacity-90">{order.items.map((item) => item.product.brand?.name || item.brand?.name || "Brand").join(" · ")}</p>
            </button>
          ))}
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
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Status</p>
                <p className={`mt-2 inline-flex border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${getOrderStatusTone(selectedOrder.status)}`}>{getOrderStatusLabel(selectedOrder.status)}</p>
                <p className="mt-2 text-sm text-zinc-600">Tracking ID: {selectedOrder.trackingId || "Pending assignment"}</p>
                {canCancelSelectedOrder ? (
                  <button
                    type="button"
                    onClick={() => setCancelConfirmOrderId(selectedOrder.id)}
                    disabled={cancelingOrderId === selectedOrder.id}
                    className="mt-3 inline-flex h-10 items-center justify-center border border-black px-3 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cancelingOrderId === selectedOrder.id ? "Canceling..." : "Cancel order"}
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
            </section>

            {cancelFeedback ? (
              <p className={`border px-3 py-2 text-sm ${cancelFeedback.toLowerCase().includes("success") ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
                {cancelFeedback}
              </p>
            ) : null}

            <section className="space-y-3 border border-zinc-300 p-5">
              <div className="flex items-end justify-between gap-4">
                <h3 className="font-heading text-3xl uppercase">Progress</h3>
                <Link href={`/account/orders/${selectedOrder.id}`} className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600">
                  View details
                </Link>
              </div>
              <div className="grid gap-3 md:grid-cols-5">
                {timelineStatuses.map((status) => {
                  const active = status === selectedOrder.status || (selectedOrder.status === "PACKED" && status === "CONFIRMED");
                  const completed = timelineStatuses.indexOf(status) <= timelineStatuses.indexOf(selectedOrder.status === "PACKED" ? "CONFIRMED" : selectedOrder.status);
                  return (
                    <div key={status} className={`border p-3 text-sm ${completed ? "border-black bg-black text-white" : "border-zinc-200 text-zinc-600"}`}>
                      <p className="text-[10px] uppercase tracking-[0.12em] opacity-80">Step</p>
                      <p className="mt-2 font-semibold uppercase tracking-[0.08em]">{getOrderStatusLabel(status)}</p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.12em]">{active ? "Current" : completed ? "Completed" : "Upcoming"}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3 border border-zinc-300 p-5">
              <h3 className="font-heading text-3xl uppercase">Items</h3>
              <div className="space-y-3">
                {selectedOrder.items.map((item) => (
                  <article key={item.id} className="grid gap-3 border-b border-zinc-200 py-3 md:grid-cols-[2fr_1fr_1fr]">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.08em]">{item.product.name}</p>
                      <p className="text-xs text-zinc-600">{item.product.brand?.name || item.brand?.name || "Brand"} / {item.product.topCategory} / {item.product.subCategory}</p>
                    </div>
                    <p className="text-sm">Qty {item.quantity}</p>
                    <p className="text-sm">{formatPkr(item.unitPricePkr)}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="space-y-3 border border-zinc-300 p-5">
              <h3 className="font-heading text-3xl uppercase">Order Events</h3>
              <div className="space-y-3">
                {selectedOrder.statusLogs.map((log) => (
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
                  {recentNotifications.map((notification) => (
                    <article key={notification.id} className="border border-zinc-200 p-3 text-sm">
                      <p className="font-semibold uppercase tracking-[0.08em]">{notification.title}</p>
                      <p className="text-zinc-600">{notification.message}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-zinc-500">{formatDateTime(notification.createdAt)}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>

      <ConfirmModal
        open={Boolean(cancelConfirmOrderId)}
        title="Cancel Order"
        description={`Are you sure you want to cancel order ${cancelConfirmOrderId ? cancelConfirmOrderId.slice(0, 10) : ""}...? This action updates stock and cannot be easily reversed.`}
        confirmText="Yes, cancel order"
        cancelText="Keep order"
        onCancel={() => setCancelConfirmOrderId(null)}
        onConfirm={() => {
          if (!cancelConfirmOrderId) return;
          void handleCancelOrder(cancelConfirmOrderId);
          setCancelConfirmOrderId(null);
        }}
      />
    </section>
  );
}
