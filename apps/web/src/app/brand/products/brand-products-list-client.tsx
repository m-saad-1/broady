"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductImage } from "@/components/ui/product-image";
import { getBrandDashboardProducts } from "@/lib/api";
import { useToastStore } from "@/stores/toast-store";
import type { Product } from "@/types/marketplace";

const approvalTone: Record<string, string> = {
  PENDING: "border-amber-300 bg-amber-50 text-amber-700",
  APPROVED: "border-emerald-300 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-300 bg-red-50 text-red-700",
  DRAFT: "border-zinc-300 bg-zinc-100 text-zinc-700",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function resolveProductImageSrc(imageUrl?: string | null) {
  const normalized = (imageUrl || "").trim();
  return normalized || "/window.svg";
}

export function BrandProductsListClient() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const nextProducts = await getBrandDashboardProducts();
      setProducts(nextProducts);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load products";
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const totals = useMemo(
    () => ({
      products: products.length,
      activeProducts: products.filter((item) => item.isActive).length,
      pendingApprovals: products.filter((item) => item.approvalStatus === "PENDING").length,
    }),
    [products],
  );

  if (loading) {
    return <p className="text-sm text-zinc-600">Loading products...</p>;
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-3">
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Products</p>
          <p className="mt-3 font-heading text-4xl">{totals.products}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Active</p>
          <p className="mt-3 font-heading text-4xl">{totals.activeProducts}</p>
        </article>
        <article className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Pending Approval</p>
          <p className="mt-3 font-heading text-4xl">{totals.pendingApprovals}</p>
        </article>
      </section>

      <section className="space-y-4 border border-zinc-300 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-3xl uppercase">Products</h2>
            <p className="mt-1 text-sm text-zinc-600">Browse and manage your brand catalog from a clean list view.</p>
          </div>
          <Link href="/brand/products/new" className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            Add Product
          </Link>
        </div>

        {products.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {products.map((product) => (
              <article key={product.id} className="border border-zinc-200 bg-white p-4 transition hover:border-black hover:shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden border border-zinc-200 bg-zinc-50">
                    <ProductImage
                      src={resolveProductImageSrc(product.imageUrl)}
                      alt={product.name || "Product image"}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link href={`/product/${product.slug}`} className="text-sm font-semibold uppercase tracking-[0.08em] underline decoration-zinc-400 underline-offset-2">
                          {product.name}
                        </Link>
                        <p className="text-xs text-zinc-600">
                          {product.topCategory} / {product.subCategory}
                        </p>
                      </div>
                      <span className={`inline-flex w-fit border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${approvalTone[product.approvalStatus || "APPROVED"] || approvalTone.APPROVED}`}>
                        {product.approvalStatus || "APPROVED"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.1em] text-zinc-600">
                      <span>PKR {formatCurrency(product.pricePkr)}</span>
                      <span>Stock {product.stock}</span>
                      <span>{product.isActive ? "Active" : "Inactive"}</span>
                    </div>

                    <p className="text-xs text-zinc-500">Sizes: {product.sizes.join(", ")}</p>

                    {/* Note: Orders count and Reviews count can be added here when API is extended to include these metrics */}

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Link
                        href={`/brand/products/${product.id}/edit`}
                        className="inline-flex h-8 items-center border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em] hover:border-black hover:bg-black hover:text-white"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">No products found yet.</p>
        )}
      </section>
    </div>
  );
}
