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

type OrderFilter = "ALL" | "NEW" | "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERY_FAILED" | "DELIVERED" | "RETURNED" | "CANCELLED";

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

const filterOptions: Array<{ key: OrderFilter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "NEW", label: "New" },
  { key: "PENDING", label: "Pending" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "PROCESSING", label: "Processing" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { key: "DELIVERY_FAILED", label: "Delivery Failed" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "RETURNED", label: "Returned" },
  { key: "CANCELLED", label: "Cancelled" },
];

const statusTone: Record<string, string> = {
  PENDING: "text-amber-700",
  CONFIRMED: "text-blue-700",
  PROCESSING: "text-indigo-700",
  SHIPPED: "text-violet-700",
  OUT_FOR_DELIVERY: "text-blue-700",
  DELIVERY_FAILED: "text-orange-700",
  DELIVERED: "text-emerald-700",
  RETURNED: "text-zinc-700",
  CANCELED: "text-rose-700",
};

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
  if (filter === "PENDING") {
    return order.status === "PENDING";
  }
  if (filter === "CONFIRMED") {
    return order.status === "CONFIRMED";
  }
  if (filter === "PROCESSING") {
    return order.status === "PROCESSING";
  }
  if (filter === "SHIPPED") {
    return order.status === "SHIPPED";
  }
  if (filter === "OUT_FOR_DELIVERY") {
    return order.status === "OUT_FOR_DELIVERY";
  }
  if (filter === "DELIVERY_FAILED") {
    return order.status === "DELIVERY_FAILED";
  }
  if (filter === "DELIVERED") {
    return order.status === "DELIVERED";
  }
  if (filter === "RETURNED") {
    return order.status === "RETURNED";
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
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return sortedOrders.filter((item) => matchesFilter(item, activeFilter));
  }, [activeFilter, sortedOrders]);

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
      <section className="flex flex-wrap items-start justify-between gap-4 border border-zinc-300 p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Brand</p>
          <h2 className="mt-2 font-heading text-4xl uppercase">{overview.brand.name}</h2>
        </div>
        <button type="button" onClick={() => void loadAll(true)} className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Total Orders</p>
          <p className="mt-3 font-heading text-3xl">{overview.metrics.totalOrders}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Open Orders</p>
          <p className="mt-3 font-heading text-3xl">{overview.metrics.openOrders}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Delivered Orders</p>
          <p className="mt-3 font-heading text-3xl">{overview.metrics.deliveredOrders}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Total Sales</p>
          <p className="mt-3 font-heading text-3xl">PKR {formatCurrency(overview.metrics.totalSalesPkr)}</p>
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

        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const lastStatusLog = [...order.statusLogs].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            )[0];
            const deliveryLabel = order.deliveryAddress.length > 72 ? `${order.deliveryAddress.slice(0, 72).trimEnd()}...` : order.deliveryAddress;
            const itemsSummary = order.items.map((item) => `${item.product.name} x${item.quantity}`).join(", ");

            return (
              <article key={order.id} className="space-y-4 border border-zinc-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/brand/orders/${order.id}`} className="text-sm font-semibold uppercase tracking-[0.08em] underline decoration-zinc-400 underline-offset-2">
                      Order {order.id}
                    </Link>
                    <p className="text-xs text-zinc-600">{order.user.fullName} / {order.user.email}</p>
                  </div>
                  <Link href={`/brand/orders/${order.id}`} className="h-9 border border-black bg-black px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white leading-9 text-center">
                    Open Details
                  </Link>
                </div>

                <div className="flex flex-wrap gap-3 border-b border-zinc-200 pb-3 text-xs uppercase tracking-[0.1em] text-zinc-700">
                  <span>
                    <span className="font-semibold">Tracking:</span> {order.trackingId || "Not assigned"}
                  </span>
                  <span>
                    <span className="font-semibold">Delivery:</span> {deliveryLabel}
                  </span>
                  <span>
                    <span className="font-semibold">Last Update:</span> {lastStatusLog ? `${lastStatusLog.status} · ${formatDateTime(lastStatusLog.createdAt)}` : formatDateTime(order.updatedAt)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.1em] text-zinc-600">
                  <span>
                    <span className="font-semibold text-zinc-700">Items:</span> {itemsSummary}
                  </span>
                  <span className={`font-semibold ${statusTone[order.status] || "text-zinc-700"}`}>
                    {order.status} · PKR {order.totalPkr.toLocaleString()}
                  </span>
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
