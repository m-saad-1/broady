"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductImage } from "@/components/ui/product-image";
import { approveProduct, getAdminBrandDashboard, rejectProduct } from "@/lib/api";
import { useToastStore } from "@/stores/toast-store";
import type { AdminBrandDashboardRecord } from "@/types/marketplace";

export function AdminBrandDashboardClient() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [entries, setEntries] = useState<AdminBrandDashboardRecord[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);

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

  const dashboardTotals = useMemo(
    () => ({
      totalBrands: entries.length,
      activeBrands: entries.filter((entry) => entry.metrics.activeProducts > 0).length,
      inactiveBrands: entries.filter((entry) => entry.metrics.activeProducts === 0).length,
      brandsWithPendingProducts: entries.filter((entry) => entry.metrics.pendingProducts > 0).length,
    }),
    [entries],
  );

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
      <div className="flex justify-end">
        <button type="button" onClick={() => void loadData("refresh")} className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Total Brands</p>
          <p className="mt-3 font-heading text-4xl">{dashboardTotals.totalBrands}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Active Brands</p>
          <p className="mt-3 font-heading text-4xl">{dashboardTotals.activeBrands}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Inactive Brands</p>
          <p className="mt-3 font-heading text-4xl">{dashboardTotals.inactiveBrands}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Brands With Pending Products</p>
          <p className="mt-3 font-heading text-4xl">{dashboardTotals.brandsWithPendingProducts}</p>
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
                <p>Active products: {selected.metrics.activeProducts}</p>
                <p>Pending products: {selected.metrics.pendingProducts}</p>
                <p>Out of stock: {selected.metrics.outOfStockProducts}</p>
              </div>
              <div className="grid gap-3 text-xs uppercase tracking-[0.12em] text-zinc-600 md:grid-cols-5">
                <p>Total orders: {selected.metrics.totalOrders}</p>
                <p>Open orders: {selected.metrics.openOrders}</p>
                <p>Delivered orders: {selected.metrics.deliveredOrders}</p>
                <p>Cancelled orders: {selected.metrics.cancelledOrders}</p>
                <p>Total sales: PKR {selected.metrics.totalSalesPkr.toLocaleString()}</p>
              </div>
            </section>

            <section className="space-y-3 border border-zinc-300 p-4">
              <h3 className="font-heading text-3xl uppercase">Products</h3>
              <div className="space-y-3">
                {selected.products.map((product) => (
                  <article key={product.id} className="space-y-3 border border-zinc-200 p-3">
                    <div className="grid gap-3 md:grid-cols-[80px_2fr_1fr_1fr] md:items-center">
                    <div className="relative h-16 w-16 overflow-hidden border border-zinc-200">
                      <ProductImage src={product.imageUrl} alt={product.name} fill className="object-cover" />
                    </div>
                    <div>
                      <Link href={`/product/${product.slug}`} className="text-sm font-semibold uppercase tracking-[0.08em] underline decoration-zinc-400 underline-offset-2">
                        {product.name}
                      </Link>
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
                    <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-center">
                      <div>
                        <Link href={`/admin/orders/${order.id}`} className="text-sm font-semibold uppercase tracking-[0.08em] underline decoration-zinc-400 underline-offset-2">
                          Order {order.id}
                        </Link>
                        <p className="text-xs text-zinc-600">{order.user.fullName} / {order.user.email}</p>
                      </div>
                      <p className="text-sm">PKR {order.totalPkr.toLocaleString()}</p>
                      <p className="text-sm font-semibold uppercase tracking-[0.08em]">{order.status}</p>
                      <Link href={`/admin/orders/${order.id}`} className="h-9 border border-black bg-black px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white leading-9 text-center">
                        View Details
                      </Link>
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
    </div>
  );
}
