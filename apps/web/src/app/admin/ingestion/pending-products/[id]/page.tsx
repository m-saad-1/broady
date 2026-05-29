"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiRequestError, getAdminIngestionPendingProductById } from "@/lib/api";
import type { Product } from "@/types/marketplace";

export default function AdminPendingProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = String(params?.id || "");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      if (!productId) {
        setError("Invalid product id.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await getAdminIngestionPendingProductById(productId);
        if (!active) return;
        setProduct(result);
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiRequestError && err.status === 404) {
          setError("Product was not found.");
        } else {
          setError(err instanceof Error ? err.message : "Unable to load product details.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadProduct();
    return () => {
      active = false;
    };
  }, [productId]);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10 lg:px-10">
      <header className="space-y-2 border-b border-zinc-300 pb-4">
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Admin Ingestion</p>
        <h1 className="font-heading text-4xl uppercase">Pending Product Details</h1>
      </header>

      {isLoading ? <p className="text-sm text-zinc-600">Loading product details...</p> : null}
      {!isLoading && error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!isLoading && !error && product ? (
        <>
          <section className="grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="font-semibold">Name:</span> {product.name}</p>
            <p><span className="font-semibold">Status:</span> {product.approvalStatus || "PENDING"}</p>
            <p><span className="font-semibold">Brand:</span> {product.brand?.name || "Unknown"}</p>
            <p><span className="font-semibold">Top Category:</span> {product.topCategory}</p>
            <p><span className="font-semibold">Sub Category:</span> {product.subCategory}</p>
            <p><span className="font-semibold">Color:</span> {product.color || "-"}</p>
            <p><span className="font-semibold">Price:</span> PKR {product.pricePkr.toLocaleString()}</p>
            <p><span className="font-semibold">Stock:</span> {product.stock}</p>
          </section>
          {product.description ? <p className="text-sm leading-7 text-zinc-700">{product.description}</p> : null}
        </>
      ) : null}

      <div>
        <Link href="/admin/ingestion" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
          Back To Ingestion
        </Link>
      </div>
    </main>
  );
}
