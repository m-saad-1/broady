"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { approveProduct, deleteProduct, getAdminProducts, rejectProduct } from "@/lib/api";
import { ProductEditorForm } from "@/components/dashboard/product-editor-form";
import { ProductImage } from "@/components/ui/product-image";
import { productToFormValues } from "@/lib/product-form";
import { formatPkr } from "@/lib/utils";
import { useToastStore } from "@/stores/toast-store";
import type { Product } from "@/types/marketplace";

type StatusFilter = "ALL" | "ACTIVE" | "PENDING" | "REJECTED";

const statusFilters: Array<{ label: string; value: StatusFilter }> = [
  { label: "All", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Pending", value: "PENDING" },
  { label: "Rejected", value: "REJECTED" },
];

function getStatus(product: Product) {
  return product.approvalStatus || (product.isActive ? "APPROVED" : "PENDING");
}

function getStatusBadgeClass(status: string) {
  if (status === "APPROVED") return "border-emerald-700 bg-emerald-600 text-white";
  if (status === "PENDING") return "border-amber-700 bg-amber-500 text-black";
  if (status === "REJECTED") return "border-rose-700 bg-rose-600 text-white";
  return "border-zinc-700 bg-zinc-800 text-white";
}

function hasDiscount(product: Product) {
  return Number(product.discountPercentage || 0) > 0 && Number(product.salePrice || 0) > 0 && Number(product.salePrice) < Number(product.actualPrice || product.pricePkr);
}

export function ProductsAdminListClient() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [brandFilter, setBrandFilter] = useState("ALL");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const nextProducts = await getAdminProducts();
      setProducts(nextProducts);
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
      activeProducts: products.filter((item) => item.isActive && getStatus(item) === "APPROVED").length,
      pendingApprovals: products.filter((item) => getStatus(item) === "PENDING").length,
      outOfStockProducts: products.filter((item) => item.isActive && getStatus(item) === "APPROVED" && item.stock <= 0).length,
    }),
    [products],
  );

  const brandOptions = useMemo(() => {
    const brandMap = new Map<string, string>();
    for (const product of products) {
      if (!product.brandId) continue;
      brandMap.set(product.brandId, product.brand?.name || "Unknown Brand");
    }
    return Array.from(brandMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const status = getStatus(product);
      if (statusFilter === "ACTIVE" && !(product.isActive && status === "APPROVED")) return false;
      if (statusFilter === "PENDING" && status !== "PENDING") return false;
      if (statusFilter === "REJECTED" && status !== "REJECTED") return false;
      if (brandFilter !== "ALL" && product.brandId !== brandFilter) return false;
      return true;
    });
  }, [brandFilter, products, statusFilter]);

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

      <section className="space-y-4 border border-zinc-300 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-3xl uppercase">Products</h2>
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{filteredProducts.length} shown</p>
          </div>
          <Link href="/admin/products/new" className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            Add Product
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-y border-zinc-200 py-3">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={`h-9 border px-3 text-xs font-semibold uppercase tracking-[0.12em] ${statusFilter === filter.value ? "border-black bg-black text-white" : "border-zinc-300 bg-white text-zinc-700"}`}
            >
              {filter.label}
            </button>
          ))}
          <select
            value={brandFilter}
            onChange={(event) => setBrandFilter(event.target.value)}
            className="h-9 min-w-48 border border-zinc-300 bg-white px-3 text-xs font-semibold uppercase tracking-[0.12em]"
          >
            <option value="ALL">All Brands</option>
            {brandOptions.map(([brandId, brandName]) => (
              <option key={brandId} value={brandId}>{brandName}</option>
            ))}
          </select>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading products...</p> : null}

        <div className="space-y-3">
          {filteredProducts.map((product) => {
            const status = getStatus(product);
            const discounted = hasDiscount(product);
            return (
              <article key={product.id} className="grid gap-3 border border-zinc-200 p-3 md:grid-cols-[92px_1fr_auto] md:items-start">
                <Link href={`/admin/products/${product.id}`} className="relative block h-28 w-full overflow-hidden border border-zinc-200 md:w-[92px]">
                  <ProductImage src={product.imageUrl} alt={product.name} fill className="object-cover" sizes="92px" />
                </Link>

                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/admin/products/${product.id}`} className="block truncate text-sm font-semibold uppercase tracking-[0.08em] underline decoration-zinc-400 underline-offset-2">
                        {product.name}
                      </Link>
                      <p className="text-xs text-zinc-600">{product.brand?.name || "-"} / {product.topCategory} / {product.subCategory}</p>
                    </div>
                    <span className={`border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${getStatusBadgeClass(status)}`}>{status}</span>
                  </div>

                  <p className="line-clamp-2 text-xs leading-5 text-zinc-700">{product.descriptionLong || product.description}</p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.08em] text-zinc-600">
                    <span>Price: <span className="font-semibold text-zinc-900">{formatPkr(product.pricePkr)}</span></span>
                    {discounted ? <span>Discounted: <span className="font-semibold text-rose-700">{formatPkr(product.salePrice || product.pricePkr)}</span></span> : null}
                    <span>Stock: <span className={product.stock > 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{product.stock}</span></span>
                    <span>Sizes: <span className="text-zinc-900">{product.sizes.join(", ") || "-"}</span></span>
                    <span>Color: <span className="text-zinc-900">{product.colors?.join(", ") || product.color || "-"}</span></span>
                    <span>Active: <span className={product.isActive ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{product.isActive ? "YES" : "NO"}</span></span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 md:justify-end">
                  <button type="button" onClick={() => setEditingProduct(product)} className="h-9 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]">Edit</button>
                  {status === "PENDING" ? (
                    <>
                      <button type="button" onClick={() => void handleApproveProduct(product)} className="h-9 border border-black bg-black px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white">Approve</button>
                      <button type="button" onClick={() => void handleRejectProduct(product)} className="h-9 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]">Reject</button>
                    </>
                  ) : null}
                  <button type="button" onClick={() => void handleDeleteProduct(product)} className="h-9 border border-zinc-900 px-3 text-xs font-semibold uppercase tracking-[0.12em]">Delete</button>
                </div>
              </article>
            );
          })}
          {!isLoading && !filteredProducts.length ? <p className="border border-dashed border-zinc-300 p-4 text-sm text-zinc-600">No products match these filters.</p> : null}
        </div>
      </section>

      {editingProduct ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingProduct(null)}>
          <div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto border border-zinc-300 bg-white p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-zinc-200 pb-4">
              <div>
                <h3 className="font-heading text-3xl uppercase">Edit Product</h3>
                <p className="text-xs text-zinc-600">{editingProduct.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="h-9 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]"
              >
                Close
              </button>
            </div>

            <ProductEditorForm
              scope="admin"
              mode="edit"
              productId={editingProduct.id}
              initialValues={productToFormValues(editingProduct)}
              cancelHref="/admin/products"
              onCancel={() => setEditingProduct(null)}
              onCompleted={() => {
                setEditingProduct(null);
                void loadData();
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
