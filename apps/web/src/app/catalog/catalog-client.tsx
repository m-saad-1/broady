"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/ui/product-card";
import { getProductPricing } from "@/lib/pricing";
import { useMockFallback } from "@/lib/runtime-flags";
import { fallbackProducts } from "../../lib/mock-data";
import { normalizeProduct } from "@/lib/taxonomy";
import type { Product } from "@/types/marketplace";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type CatalogClientProps = {
  initialProducts: Product[];
  params: Record<string, string>;
};

function scoreProductMatch(product: Product, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const name = product.name.toLowerCase();
  const brand = product.brand?.name?.toLowerCase() || "";
  const subCategory = product.subCategory.toLowerCase();
  const type = (product.productType || "").toLowerCase();
  const topCategory = product.topCategory.toLowerCase();

  if (name === q) return 120;
  if (name.startsWith(q)) return 100;
  if (name.includes(q)) return 80;
  if (subCategory.startsWith(q)) return 65;
  if (subCategory.includes(q)) return 60;
  if (brand.startsWith(q)) return 55;
  if (brand.includes(q)) return 50;
  if (type === q) return 42;
  if (topCategory === q) return 40;

  return 0;
}

async function fetchProducts(params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  const hasActiveFilters = Boolean(
    params.q ||
      params.brand ||
      params.topCategory ||
      params.productType ||
      params.subCategory ||
      params.size ||
      params.minPrice ||
      params.maxPrice,
  );

  try {
    const response = await fetch(`${API_BASE}/products${query ? `?${query}` : ""}`);
    if (!response.ok) throw new Error("Failed request");

    const json = (await response.json()) as { data: Product[] };
    const normalizedApi = json.data.map(normalizeProduct);
    let normalized = normalizedApi;
    if (useMockFallback && !hasActiveFilters) {
      const fallback = fallbackProducts.map(normalizeProduct);
      const seen = new Set(normalizedApi.map((item) => item.slug));
      normalized = [...normalizedApi];
      for (const item of fallback) {
        if (!seen.has(item.slug)) {
          normalized.push(item);
        }
      }
    } else if (!normalized.length && !hasActiveFilters) {
      normalized = fallbackProducts.map(normalizeProduct);
    }
    return normalized;
  } catch {
    if (hasActiveFilters) {
      return [];
    }

    let normalized = fallbackProducts.map(normalizeProduct);
    if (params.q) {
      normalized = normalized
        .map((product) => ({ product, score: scoreProductMatch(product, params.q || "") }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.product);
    }
    if (params.topCategory) normalized = normalized.filter((product) => product.topCategory === params.topCategory);
    if (params.productType) normalized = normalized.filter((product) => product.productType === params.productType);
    if (params.subCategory) normalized = normalized.filter((product) => product.subCategory === params.subCategory);
    if (params.size) normalized = normalized.filter((product) => product.sizes.includes(params.size || ""));
    return normalized;
  }
}

export function CatalogClient({ initialProducts, params }: CatalogClientProps) {
  const router = useRouter();
  const [topCategory, setTopCategory] = useState(params.topCategory || "");
  const [productType, setProductType] = useState(params.productType || "");
  const [subCategory, setSubCategory] = useState(params.subCategory || "");
  const [size, setSize] = useState(params.size || "");
  const [sortBy, setSortBy] = useState(params.sortBy || "latest");

  const queryFromRoute = useMemo(() => params.q?.trim() || "", [params.q]);
  const hasActiveSearch = Boolean(queryFromRoute);

  useEffect(() => {
    setTopCategory(params.topCategory || "");
    setProductType(params.productType || "");
    setSubCategory(params.subCategory || "");
    setSize(params.size || "");
    setSortBy(params.sortBy || "latest");
  }, [params.topCategory, params.productType, params.subCategory, params.size, params.sortBy]);

  const normalizedInitialProducts = useMemo(() => {
    const source = initialProducts.length ? initialProducts : fallbackProducts;
    return source.map(normalizeProduct);
  }, [initialProducts]);

  const topCategoryOptions = useMemo(
    () => Array.from(new Set(normalizedInitialProducts.map((item) => item.topCategory))).sort(),
    [normalizedInitialProducts],
  );

  const typeSource = useMemo(
    () => normalizedInitialProducts.filter((item) => !topCategory || item.topCategory === topCategory),
    [normalizedInitialProducts, topCategory],
  );
  const productTypeOptions = useMemo(
    () => Array.from(new Set(typeSource.map((item) => item.productType))).sort() as string[],
    [typeSource],
  );
  const effectiveProductType = productType && productTypeOptions.includes(productType) ? productType : "";

  const subCategorySource = useMemo(
    () =>
      normalizedInitialProducts.filter(
        (item) =>
          (!topCategory || item.topCategory === topCategory) &&
          (!effectiveProductType || item.productType === effectiveProductType),
      ),
    [effectiveProductType, normalizedInitialProducts, topCategory],
  );
  const subCategoryOptions = useMemo(
    () => Array.from(new Set(subCategorySource.map((item) => item.subCategory))).sort(),
    [subCategorySource],
  );
  const effectiveSubCategory =
    subCategory && subCategoryOptions.includes(subCategory) ? subCategory : "";

  const sizeSource = useMemo(
    () =>
      normalizedInitialProducts.filter(
        (item) =>
          (!topCategory || item.topCategory === topCategory) &&
          (!effectiveProductType || item.productType === effectiveProductType) &&
          (!effectiveSubCategory || item.subCategory === effectiveSubCategory),
      ),
    [effectiveProductType, effectiveSubCategory, normalizedInitialProducts, topCategory],
  );
  const sizeOptions = useMemo(() => {
    const values = Array.from(new Set(sizeSource.flatMap((item) => item.sizes))).sort();
    return values;
  }, [sizeSource]);
  const effectiveSize = size && sizeOptions.includes(size) ? size : "";

  const runtimeParams = useMemo(() => {
    const next: Record<string, string> = {};
    if (queryFromRoute) next.q = queryFromRoute;
    if (topCategory) next.topCategory = topCategory;
    if (effectiveProductType) next.productType = effectiveProductType;
    if (effectiveSubCategory) next.subCategory = effectiveSubCategory;
    if (effectiveSize) next.size = effectiveSize;
    if (sortBy !== "latest") next.sortBy = sortBy;
    return next;
  }, [effectiveProductType, effectiveSize, effectiveSubCategory, queryFromRoute, sortBy, topCategory]);

  const { data: products = initialProducts } = useQuery({
    queryKey: ["products", runtimeParams],
    queryFn: () => fetchProducts(runtimeParams),
    initialData: initialProducts,
  });

  const orderedProducts = useMemo(() => {
    const copy = [...products];
    if (sortBy === "price-asc") return copy.sort((a, b) => getProductPricing(a).finalPrice - getProductPricing(b).finalPrice);
    if (sortBy === "price-desc") return copy.sort((a, b) => getProductPricing(b).finalPrice - getProductPricing(a).finalPrice);
    if (sortBy === "name") return copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  }, [products, sortBy]);

  useEffect(() => {
    const next = new URLSearchParams(runtimeParams);
    const href = next.toString() ? `/catalog?${next.toString()}` : "/catalog";
    router.replace(href, { scroll: false });
  }, [router, runtimeParams]);

  return (
    <div className="space-y-5">
      <section className="space-y-3 border border-zinc-300 p-4">
        {hasActiveSearch ? (
          <div className="flex flex-wrap items-center gap-2 border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs uppercase tracking-[0.12em]">
            <span className="font-semibold">Search: {queryFromRoute}</span>
            <button
              type="button"
              className="ml-auto border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] hover:border-black"
              onClick={() => {
                setTopCategory("");
                setProductType("");
                setSubCategory("");
                setSize("");
                setSortBy("latest");
                router.replace("/catalog", { scroll: false });
              }}
              aria-label="Clear active search"
              title="Clear search"
            >
              ×
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em]">
          <select className="h-9 border border-zinc-300 px-2" value={topCategory} onChange={(event) => setTopCategory(event.target.value)}>
            <option value="">All genders</option>
            {topCategoryOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="h-9 border border-zinc-300 px-2" value={effectiveProductType} onChange={(event) => setProductType(event.target.value)}>
            <option value="">All types</option>
            {productTypeOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="h-9 border border-zinc-300 px-2" value={effectiveSubCategory} onChange={(event) => setSubCategory(event.target.value)}>
            <option value="">All subcategories</option>
            {subCategoryOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="h-9 border border-zinc-300 px-2" value={effectiveSize} onChange={(event) => setSize(event.target.value)}>
            <option value="">All sizes</option>
            {sizeOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="h-9 border border-zinc-300 px-2" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            {[
              { value: "latest", label: "Latest" },
              { value: "price-asc", label: "Price Low to High" },
              { value: "price-desc", label: "Price High to Low" },
              { value: "name", label: "Name A-Z" },
            ].map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {orderedProducts.map((product) => (
          <ProductCard key={product.id} product={normalizeProduct(product)} />
        ))}
      </section>

      {!orderedProducts.length ? (
        <section className="border border-zinc-300 p-8 text-center">
          <p className="font-heading text-3xl uppercase">This product is not available</p>
          <p className="mt-2 text-sm text-zinc-600">Try changing your filters or search query.</p>
        </section>
      ) : null}
    </div>
  );
}
