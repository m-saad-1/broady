"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrandDashboardProducts } from "@/lib/api";
import { useToastStore } from "@/stores/toast-store";
import type { Product } from "@/types/marketplace";
import { BrandProductEditClient } from "./brand-product-edit-client";

type BrandProductEditRouteClientProps = {
  productId: string;
};

export function BrandProductEditRouteClient({ productId }: BrandProductEditRouteClientProps) {
  const pushToast = useToastStore((state) => state.pushToast);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const products = await getBrandDashboardProducts();
      const matched = products.find((item) => item.id === productId) || null;
      setProduct(matched);
      if (!matched) {
        pushToast("Product not found for this brand", "error");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load product";
      pushToast(message, "error");
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [productId, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-zinc-600">Loading product...</p>;
  }

  if (!product) {
    return <p className="border border-zinc-300 p-4 text-sm text-zinc-700">Product not found.</p>;
  }

  return <BrandProductEditClient product={product} />;
}
