"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/ui/product-card";
import { normalizeProduct } from "@/lib/taxonomy";
import type { Product } from "@/types/marketplace";

type Props = {
  products: Product[];
};

export function BrandCollectionClient({ products }: Props) {
  const [topCategory, setTopCategory] = useState<string>("All");
  const [productType, setProductType] = useState<string>("All");

  const normalized = useMemo(() => products.map(normalizeProduct), [products]);

  const filtered = useMemo(() => {
    return normalized.filter((product) => {
      const categoryOk = topCategory === "All" || product.topCategory === topCategory;
      const typeOk = productType === "All" || product.productType === productType;
      return categoryOk && typeOk;
    });
  }, [normalized, productType, topCategory]);

  return (
    <section className="space-y-4">
      <h2 className="font-heading text-3xl uppercase">Collections</h2>
      <div className="border border-zinc-300 p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em]">
          <span className="text-zinc-500">Category</span>
          <select className="h-9 border border-zinc-300 px-2" value={topCategory} onChange={(event) => setTopCategory(event.target.value)}>
            {["All", "Men", "Women", "Kids"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <span className="text-zinc-400">/</span>
          <span className="text-zinc-500">Type</span>
          <select className="h-9 border border-zinc-300 px-2" value={productType} onChange={(event) => setProductType(event.target.value)}>
            {["All", "Top", "Bottom", "Footwear", "Accessories"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <section className="border border-zinc-300 p-8 text-center">
          <p className="font-heading text-3xl uppercase">This product is not available</p>
          <p className="mt-2 text-sm text-zinc-600">Try changing gender or category filters.</p>
        </section>
      )}
    </section>
  );
}
