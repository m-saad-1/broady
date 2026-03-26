"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/ui/product-card";
import { normalizeProduct } from "@/lib/taxonomy";
import type { Product } from "@/types/marketplace";

type Props = {
  products: Product[];
  category: string;
};

export function CategoryCollectionClient({ products, category }: Props) {
  const [productType, setProductType] = useState<string>("");
  const [subCategory, setSubCategory] = useState<string>("");
  const [size, setSize] = useState<string>("");

  const normalized = useMemo(() => {
    const target = category.toLowerCase();
    return products
      .map(normalizeProduct)
      .filter((product) => product.topCategory.toLowerCase() === target);
  }, [category, products]);

  const productTypeOptions = useMemo(
    () => Array.from(new Set(normalized.map((item) => item.productType))).sort(),
    [normalized],
  );

  const subCategorySource = useMemo(
    () => normalized.filter((product) => !productType || product.productType === productType),
    [normalized, productType],
  );

  const subCategoryOptions = useMemo(
    () => Array.from(new Set(subCategorySource.map((item) => item.subCategory))).sort(),
    [subCategorySource],
  );
  const effectiveSubCategory =
    subCategory && subCategoryOptions.includes(subCategory) ? subCategory : "";

  const sizeSource = useMemo(
    () =>
      normalized.filter(
        (product) =>
          (!productType || product.productType === productType) &&
          (!effectiveSubCategory || product.subCategory === effectiveSubCategory),
      ),
    [effectiveSubCategory, normalized, productType],
  );

  const sizeOptions = useMemo(() => Array.from(new Set(sizeSource.flatMap((item) => item.sizes))).sort(), [sizeSource]);
  const effectiveSize = size && sizeOptions.includes(size) ? size : "";

  const filtered = useMemo(
    () =>
      normalized.filter((product) => {
        const typeOk = !productType || product.productType === productType;
        const subCategoryOk = !effectiveSubCategory || product.subCategory === effectiveSubCategory;
        const sizeOk = !effectiveSize || product.sizes.includes(effectiveSize);
        return typeOk && subCategoryOk && sizeOk;
      }),
    [effectiveSize, effectiveSubCategory, normalized, productType],
  );

  const availableSubcategories = useMemo(
    () => [...new Set(filtered.map((item) => item.subCategory))],
    [filtered],
  );

  return (
    <div className="space-y-5">
      <section className="border border-zinc-300 p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em]">
          <span className="text-zinc-500">Type</span>
          <select className="h-9 border border-zinc-300 px-2" value={productType} onChange={(event) => setProductType(event.target.value)}>
            <option value="">Type</option>
            {productTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <span className="text-zinc-400">/</span>
          <span className="text-zinc-500">Subcategory</span>
          <select className="h-9 border border-zinc-300 px-2" value={effectiveSubCategory} onChange={(event) => setSubCategory(event.target.value)}>
            <option value="">Subcategory</option>
            {subCategoryOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <span className="text-zinc-400">/</span>
          <span className="text-zinc-500">Size</span>
          <select className="h-9 border border-zinc-300 px-2" value={effectiveSize} onChange={(event) => setSize(event.target.value)}>
            <option value="">Size</option>
            {sizeOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </section>

      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
        Subcategories: {availableSubcategories.length ? availableSubcategories.join(" / ") : "-"}
      </p>

      {filtered.length ? (
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </section>
      ) : (
        <section className="border border-zinc-300 p-8 text-center">
          <p className="font-heading text-3xl uppercase">This product is not available</p>
          <p className="mt-2 text-sm text-zinc-600">Try changing your category filters.</p>
        </section>
      )}
    </div>
  );
}
