"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrandDashboardOrders, getBrandDashboardOverview, getBrandDashboardProducts } from "@/lib/api";
import { useToastStore } from "@/stores/toast-store";
import type { BrandDashboardOrder, BrandDashboardOverview, Product } from "@/types/marketplace";

type BrandOrdersClientProps = {
  title?: string;
  mode?: "dashboard" | "orders";
};

type OrderFilter = "ALL" | "NEW" | "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

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

function getOrderPriority(status: BrandDashboardOrder["status"]) {
  if (status === "DELIVERED") return 1;
  if (status === "CANCELED") return 2;
  return 0;
}

const filterOptions: Array<{ key: OrderFilter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "NEW", label: "New" },
  { key: "PENDING", label: "Pending" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "CANCELLED", label: "Cancelled" },
];

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function matchesFilter(order: BrandDashboardOrder, filter: OrderFilter) {
  if (filter === "ALL") return true;
  if (filter === "NEW") {
    // New orders are those that were just created (PENDING status)
    return order.status === "PENDING";
  }
  if (filter === "SHIPPED") {
    return order.status === "SHIPPED" || order.status === "PARTIALLY_SHIPPED";
  }
  if (filter === "DELIVERED") {
    return order.status === "DELIVERED";
  }
  if (filter === "CANCELLED") {
    return order.status === "CANCELED";
  }

  return order.status === filter;
}

export function BrandOrdersClient({ title = "Orders", mode = "orders" }: BrandOrdersClientProps) {
  const pushToast = useToastStore((state) => state.pushToast);
  const [overview, setOverview] = useState<BrandDashboardOverview | null>(null);
  const [orders, setOrders] = useState<BrandDashboardOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<OrderFilter>(mode === "dashboard" ? "NEW" : "ALL");

  const showProductPanel = mode === "dashboard";

  const loadAll = useCallback(async (refreshMode = false) => {
    if (refreshMode) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [nextOverview, nextOrders, nextProducts] = await Promise.all([
        getBrandDashboardOverview(),
        getBrandDashboardOrders(),
        showProductPanel ? getBrandDashboardProducts() : Promise.resolve([] as Product[]),
      ]);
      setOverview(nextOverview);
      setOrders(nextOrders);
      setProducts(nextProducts);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load brand orders";
      pushToast(message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pushToast, showProductPanel]);

  useEffect(() => {
    void loadAll(false);
  }, [loadAll]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const priorityGap = getOrderPriority(a.status) - getOrderPriority(b.status);
      if (priorityGap !== 0) return priorityGap;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return sortedOrders.filter((item) => matchesFilter(item, activeFilter));
  }, [activeFilter, sortedOrders]);

  const openOrders = useMemo(() => orders.filter((item) => !["DELIVERED", "CANCELED"].includes(item.status)).length, [orders]);

  const topProducts = useMemo(
    () => [...products].sort((a, b) => b.stock - a.stock).slice(0, 4),
    [products],
  );

  const recentProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 4);
  }, [products]);

  if (loading) {
    return <p className="text-sm text-zinc-600">Loading brand orders...</p>;
  }

  if (!overview) {
    return <p className="border border-zinc-300 p-4 text-sm text-zinc-700">No brand membership found for this account.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="border border-zinc-300 p-4">
        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Brand</p>
        <h2 className="mt-2 font-heading text-4xl uppercase">{overview.brand.name}</h2>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Total Orders</p>
          <p className="mt-3 font-heading text-3xl">{orders.length}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Open Orders</p>
          <p className="mt-3 font-heading text-3xl">{openOrders}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Gross Sales</p>
          <p className="mt-3 font-heading text-3xl">PKR {formatCurrency(overview.metrics.grossPkr)}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Live Updates</p>
          <button type="button" onClick={() => void loadAll(true)} className="mt-3 text-sm font-semibold uppercase tracking-[0.08em] text-zinc-700">
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </article>
      </section>

      <section className="space-y-3 border border-zinc-300 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-heading text-3xl uppercase">{title}</h2>
          {mode === "dashboard" ? (
            <Link href="/brand/orders" className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600">
              View All Orders
            </Link>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 border-b border-zinc-300 pb-3">
          {filterOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setActiveFilter(option.key)}
              className={`h-9 border px-3 text-xs font-semibold uppercase tracking-[0.12em] ${activeFilter === option.key ? "border-black bg-black text-white" : "border-zinc-300"}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {filteredOrders.length === 0 ? <p className="text-sm text-zinc-600">No orders found for this filter.</p> : null}

        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const lastStatusLog = [...order.statusLogs].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            )[0];
            const customerName = order.user?.fullName || "Customer";
            const customerEmail = order.user?.email || "Email unavailable";

            return (
              <article key={order.id} className="border border-zinc-200 bg-white p-5 transition hover:border-black hover:shadow-sm">
                {/* Header: Order ID, Status Badge, and Action Button */}
                <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-start md:gap-4">
                  <div className="flex-1">
                    <Link href={`/brand/orders/${order.id}`} className="text-base font-semibold uppercase tracking-[0.08em] underline decoration-zinc-400 underline-offset-2">
                      Order {order.id.slice(0, 10)}...
                    </Link>
                    <p className="mt-1 text-sm text-zinc-700">
                      <span className="font-semibold">{customerName}</span> • <span className="text-zinc-600">{customerEmail}</span>
                    </p>
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{formatDateTime(order.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 md:flex-col md:items-end">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex border border-black bg-black px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                        {order.status}
                      </span>
                      <span className="text-xs text-zinc-600">{order.paymentStatus}</span>
                    </div>
                    <Link href={`/brand/orders/${order.id}`} className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white text-center leading-10">
                      View Details
                    </Link>
                  </div>
                </div>

                {/* Order Details Grid */}
                <div className="border-t border-zinc-200 pt-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    {/* Tracking ID */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Tracking ID</p>
                      <p className="text-sm text-zinc-700">{order.trackingId || "Not assigned"}</p>
                    </div>

                    {/* Delivery Address */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Delivery Address</p>
                      <p className="text-sm text-zinc-700">{truncateText(order.deliveryAddress, 60)}</p>
                    </div>

                    {/* Last Update */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Last Update</p>
                      <p className="text-sm text-zinc-700">
                        {lastStatusLog ? (
                          <>
                            <span className="font-semibold">{lastStatusLog.status}</span> • {formatDateTime(lastStatusLog.createdAt)}
                          </>
                        ) : (
                          "No updates"
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Products Section */}
                  <div className="mt-4 border-t border-zinc-100 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Products Ordered</p>
                    <p className="mt-2 text-sm text-zinc-700">{order.items.map((item) => item.product.name).join(", ")}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {showProductPanel ? (
        <section className="space-y-5 border border-zinc-300 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-heading text-3xl uppercase">Recent / Top Products</h2>
            <div className="flex flex-wrap gap-2">
              <Link href="/brand/products" className="inline-flex h-9 items-center border border-black bg-black px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                View Products
              </Link>
              <Link href="/brand/products" className="inline-flex h-9 items-center border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]">
                View All Products
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Top by stock</p>
              <div className="space-y-2">
                {topProducts.length ? (
                  topProducts.map((product) => (
                    <article key={`top-${product.id}`} className="border border-zinc-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link href={`/product/${product.slug}`} className="text-sm font-semibold uppercase tracking-[0.08em] underline decoration-zinc-400 underline-offset-2">
                            {product.name}
                          </Link>
                          <p className="text-xs text-zinc-600">{product.topCategory} / {product.subCategory}</p>
                        </div>
                        <p className="text-xs uppercase tracking-[0.12em] text-zinc-600">Stock {product.stock}</p>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-zinc-600">No products found yet.</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Recently updated</p>
              <div className="space-y-2">
                {recentProducts.length ? (
                  recentProducts.map((product) => (
                    <article key={`recent-${product.id}`} className="border border-zinc-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link href={`/product/${product.slug}`} className="text-sm font-semibold uppercase tracking-[0.08em] underline decoration-zinc-400 underline-offset-2">
                            {product.name}
                          </Link>
                          <p className="text-xs text-zinc-600">PKR {formatCurrency(product.pricePkr)}</p>
                        </div>
                        <p className="text-xs uppercase tracking-[0.12em] text-zinc-600">
                          {formatDateTime(product.updatedAt || product.createdAt)}
                        </p>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-zinc-600">No products found yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
