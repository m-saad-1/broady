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
  updateUserOrderAddress,
  type CancelReasonCode,
} from "@/lib/api";
import { formatPkr } from "@/lib/utils";
import { getOrderStatusLabel, getOrderStatusTone } from "@/lib/order-status";
import type { NotificationItem, UserOrder } from "@/types/marketplace";
import { useCartStore } from "@/stores/cart-store";
import { resolveMediaUrl } from "@/lib/media-url";

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
  return order.subOrders.length > 0 && order.subOrders.every((subOrder) => ["DELIVERED", "RETURNED", "CANCELED"].includes(subOrder.status));
}

export function OrderTrackerClient({ compact = false }: OrderTrackerClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setCartItems = useCartStore((state) => state.setItems);
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
  const [editingAddress, setEditingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [updatingAddress, setUpdatingAddress] = useState(false);
  const [activeTab, setActiveTab] = useState<"OPEN" | "DELIVERED" | "CANCELED" | "RETURNED">("OPEN");


  const visibleOrders = useMemo(
    () =>
      orders.filter((order) => {
        if (order.status !== "CANCELED") return true;
        return Date.now() - new Date(order.updatedAt || order.createdAt).getTime() <= CANCEL_RETENTION_MS;
      }),
    [orders],
  );

  const activeOrders = useMemo(
    () => visibleOrders.filter((order) => !["DELIVERED", "RETURNED", "CANCELED"].includes(order.status)),
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
  
  const displayedSubOrders = useMemo(() => {
    return visibleSubOrders.filter((subOrder) => {
      if (activeTab === "OPEN") return !["DELIVERED", "CANCELED", "RETURNED"].includes(subOrder.status);
      if (activeTab === "DELIVERED") return subOrder.status === "DELIVERED";
      if (activeTab === "CANCELED") return subOrder.status === "CANCELED";
      if (activeTab === "RETURNED") return subOrder.status === "RETURNED";
      return false;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [visibleSubOrders, activeTab]);
  const openItems = useMemo(
    () => visibleSubOrders.filter((subOrder) => !["DELIVERED", "RETURNED", "CANCELED"].includes(subOrder.status)).length,
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
      const result = await reorderUserOrder(orderId);
      setCartItems(
        result.items.map((item) => ({
          product: item.product,
          quantity: item.quantity,
          selectedColor: item.selectedColor || undefined,
          selectedSize: item.selectedSize || undefined,
        })),
      );
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
      const result = await reorderUserSubOrder(orderId, subOrderId);
      setCartItems(
        result.items.map((item) => ({
          product: item.product,
          quantity: item.quantity,
          selectedColor: item.selectedColor || undefined,
          selectedSize: item.selectedSize || undefined,
        })),
      );
      setCancelFeedback("Items from this vendor group were added to your cart.");
      router.push("/cart");
    } catch (error) {
      setCancelFeedback(error instanceof Error ? error.message : "Unable to reorder this vendor group right now.");
    } finally {
      setReorderingSubOrderId(null);
    }
  }, [router]);

  const handleUpdateAddress = useCallback(async () => {
    if (!selectedOrder || !newAddress.trim()) return;
    setUpdatingAddress(true);
    setCancelFeedback("");
    try {
      await updateUserOrderAddress(selectedOrder.id, newAddress.trim());
      setCancelFeedback("Address updated successfully. Sub-orders moved to Ready for Re-delivery.");
      setEditingAddress(false);
      await loadOrders("refresh");
    } catch (error) {
      setCancelFeedback(error instanceof Error ? error.message : "Unable to update address.");
    } finally {
      setUpdatingAddress(false);
    }
  }, [selectedOrder, newAddress, loadOrders]);

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
            <Link key={order.id} href={`/account/orders?orderId=${order.id}`} className="block border border-zinc-300 p-4 transition hover:border-black hover:bg-zinc-50">
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
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-300 pb-3">
        <div className="space-y-2">
          <h2 className="font-heading text-3xl uppercase tracking-[0.06em]">Orders & Tracking</h2>
          <p className="text-sm text-zinc-600">Track order status, review item details, and keep support actions close at hand.</p>
        </div>
        <button type="button" onClick={() => void loadOrders("refresh")} className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600">
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-200">
        {(["OPEN", "DELIVERED", "CANCELED", "RETURNED"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors border-b-2 ${
              activeTab === tab ? "border-black text-black" : "border-transparent text-zinc-500 hover:text-black"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Cards */}
      {displayedSubOrders.length === 0 ? (
        <div className="border border-zinc-300 p-8 text-center bg-zinc-50">
          <p className="text-sm text-zinc-600">No {activeTab.toLowerCase()} items found.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {displayedSubOrders.map((subOrder) => {
            const firstItem = subOrder.items[0];
            const parentOrder = orders.find(o => o.id === subOrder.orderId);
            return (
              <article key={subOrder.id} className="border border-zinc-300 p-5 bg-white flex flex-col md:flex-row gap-6">
                {/* Product Images (show up to 3) */}
                <div className="flex gap-2 shrink-0">
                  {subOrder.items.slice(0, 3).map(item => (
                    <img key={item.id} src={resolveMediaUrl(item.product?.images?.[0]?.url)} alt={item.product?.name || "Product"} className="w-24 h-32 object-cover border border-zinc-200 bg-zinc-50" />
                  ))}
                </div>
                
                {/* Details */}
                <div className="flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.08em]">{subOrder.brand?.name || "Brand"}</p>
                        <p className="mt-1 text-xs text-zinc-600 uppercase tracking-[0.08em]">{subOrder.items.length} Items • Order #{formatShortOrderId(subOrder.orderId)}</p>
                      </div>
                      <p className={`inline-flex border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${getOrderStatusTone(subOrder.status)}`}>
                        {getOrderStatusLabel(subOrder.status)}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Price</p>
                        <p className="font-semibold mt-1">{formatPkr(subOrder.subtotalPkr)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Timeline</p>
                        <p className="font-semibold mt-1">{formatDateTime(subOrder.createdAt).split(",")[0]}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Tracking Progress</p>
                        <p className="font-semibold mt-1 truncate">{subOrder.trackingId ? `Tracking: ${subOrder.trackingId}` : "Awaiting tracking details"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-zinc-100">
                    <button type="button" onClick={() => router.push(`/account/orders/${subOrder.orderId}/groups/${subOrder.id}`)} className="h-9 border border-black bg-black px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                      Track
                    </button>
                    {["DELIVERED", "CANCELED", "RETURNED"].includes(subOrder.status) ? (
                      <button 
                        type="button" 
                        onClick={() => void handleReorderSubOrder(subOrder.orderId, subOrder.id)} 
                        disabled={reorderingSubOrderId === subOrder.id}
                        className="h-9 border border-zinc-300 px-4 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                      >
                        {reorderingSubOrderId === subOrder.id ? "Reordering..." : "Reorder"}
                      </button>
                    ) : null}
                    {subOrder.status === "DELIVERED" ? (
                      <button type="button" className="h-9 border border-zinc-300 px-4 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-50 cursor-not-allowed">
                        Download Invoice
                      </button>
                    ) : null}
                    <a href={`mailto:support@broady.local?subject=Support%20for%20order%20${subOrder.orderId}`} className="h-9 inline-flex items-center border border-zinc-300 px-4 text-[11px] font-semibold uppercase tracking-[0.12em] hover:bg-zinc-50">
                      Contact Support
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Cancel Order Modal Logic (Retained but simplified since we aren't showing the complex view, however cancel actions might be needed from tracking detail page, which is separate.) */}
    </section>
  );
}
