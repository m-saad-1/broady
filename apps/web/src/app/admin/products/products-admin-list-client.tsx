"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approveProduct,
  deleteProduct,
  getAdminProducts,
  getPendingProducts,
  rejectProduct,
} from "@/lib/api";
import { useToastStore } from "@/stores/toast-store";
import type { Product } from "@/types/marketplace";

export function ProductsAdminListClient() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextProducts, nextPendingProducts] = await Promise.all([
        getAdminProducts(),
        getPendingProducts(),
      ]);
      setProducts(nextProducts);
      setPendingProducts(nextPendingProducts);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load products";
      pushToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totals = useMemo(
    () => ({
      products: products.length,
      activeProducts: products.filter((item) => item.isActive && item.approvalStatus === "APPROVED").length,
      pendingApprovals: pendingProducts.length,
      outOfStockProducts: products.filter((item) => item.isActive && item.approvalStatus === "APPROVED" && item.stock <= 0).length,
    }),
    [pendingProducts.length, products],
  );

  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm(`Delete product ${product.name}?`)) return;

    try {
      const message = await deleteProduct(product.id);
      pushToast(message || "Product deleted", "success");
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete product";
      pushToast(message, "error");
    }
  };

  const handleApproveProduct = async (product: Product) => {
    try {
      await approveProduct(product.id);
      pushToast("Product approved", "success");
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to approve product";
      pushToast(message, "error");
    }
  };

  const handleRejectProduct = async (product: Product) => {
    try {
      await rejectProduct(product.id, "Rejected by Broady");
      pushToast("Product rejected", "success");
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reject product";
      pushToast(message, "error");
    }
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-4">
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Total Products</p>
          <p className="mt-3 font-heading text-4xl">{totals.products}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Active Products</p>
          <p className="mt-3 font-heading text-4xl">{totals.activeProducts}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Pending Approval</p>
          <p className="mt-3 font-heading text-4xl">{totals.pendingApprovals}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Out of Stock</p>
          <p className="mt-3 font-heading text-4xl">{totals.outOfStockProducts}</p>
        </article>
      </section>

      {pendingProducts.length ? (
        <section className="space-y-3 border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-heading text-3xl uppercase">Pending Product Approvals</h2>
          {pendingProducts.map((product) => (
            <div key={product.id} className="grid gap-3 border-b border-amber-200 py-3 md:grid-cols-[2fr_1fr_auto] md:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.08em]">{product.name}</p>
                <p className="text-xs text-zinc-700">{product.brand?.name || "Brand"} / {product.topCategory} / {product.subCategory}</p>
              </div>
              <p className="text-sm">PKR {product.pricePkr.toLocaleString()}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => void handleApproveProduct(product)} className="h-9 border border-black bg-black px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white">Approve</button>
                <button type="button" onClick={() => void handleRejectProduct(product)} className="h-9 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]">Reject</button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-3 border border-zinc-300 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-heading text-3xl uppercase">Products</h2>
          <Link href="/admin/products/new" className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            Add Product
          </Link>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading products...</p> : null}

        <div className="space-y-3">
          {products.map((product) => (
            <article key={product.id} className="space-y-2 border border-zinc-200 p-3">
              <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto] md:items-center">
                <div>
                  <Link href={`/product/${product.slug}`} className="text-sm font-semibold uppercase tracking-[0.08em] underline decoration-zinc-400 underline-offset-2">
                    {product.name}
                  </Link>
                  <p className="text-xs text-zinc-600">{product.brand?.name || "-"} / {product.topCategory} / {product.subCategory}</p>
                  <p className="mt-1 text-xs text-zinc-700 line-clamp-2">{product.description}</p>
                </div>
                <div className="space-y-1 text-xs text-zinc-700">
                  <p>Price: PKR {product.pricePkr.toLocaleString()}</p>
                  <p>Stock: {product.stock}</p>
                  <p>Status: {product.approvalStatus || "APPROVED"}</p>
                  <p>Active: {product.isActive ? "Yes" : "No"}</p>
                  <p>Sizes: {product.sizes.join(", ")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void handleDeleteProduct(product)} className="border border-black bg-black px-3 py-1 text-xs uppercase tracking-[0.12em] text-white">Delete</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
