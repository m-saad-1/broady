"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
  try {
    const response = await fetch(`${API_BASE}/products${query ? `?${query}` : ""}`);
    if (!response.ok) throw new Error("Failed request");

    const json = (await response.json()) as { data: Product[] };
    const normalizedApi = json.data.map(normalizeProduct);
    let normalized = normalizedApi;
    if (useMockFallback) {
      const fallback = fallbackProducts.map(normalizeProduct);
      const seen = new Set(normalizedApi.map((item) => item.slug));
      normalized = [...normalizedApi];
      for (const item of fallback) {
        if (!seen.has(item.slug)) {
          normalized.push(item);
        }
      }
    } else if (!normalized.length) {
      normalized = fallbackProducts.map(normalizeProduct);
    }
    if (params.q) {
      normalized = normalized
        .map((product) => ({ product, score: scoreProductMatch(product, params.q || "") }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.product);
    }

    return normalized;
  } catch {
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
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [q, setQ] = useState(params.q || "");
  const [liveQuery, setLiveQuery] = useState(params.q || "");
  const [topCategory, setTopCategory] = useState(params.topCategory || "");
  const [productType, setProductType] = useState(params.productType || "");
  const [subCategory, setSubCategory] = useState(params.subCategory || "");
  const [size, setSize] = useState(params.size || "");
  const [sortBy, setSortBy] = useState(params.sortBy || "latest");

  useEffect(() => {
    const timeout = setTimeout(() => setQ(liveQuery), 180);
    return () => clearTimeout(timeout);
  }, [liveQuery]);

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
    if (q.trim()) next.q = q.trim();
    if (topCategory) next.topCategory = topCategory;
    if (effectiveProductType) next.productType = effectiveProductType;
    if (effectiveSubCategory) next.subCategory = effectiveSubCategory;
    if (effectiveSize) next.size = effectiveSize;
    if (sortBy !== "latest") next.sortBy = sortBy;
    return next;
  }, [effectiveProductType, effectiveSize, effectiveSubCategory, q, sortBy, topCategory]);

  const { data: products = initialProducts } = useQuery({
    queryKey: ["products", runtimeParams],
    queryFn: () => fetchProducts(runtimeParams),
    initialData: initialProducts,
  });

  const suggestions = useMemo(() => {
    const query = liveQuery.trim().toLowerCase();
    if (query.length < 2) return [] as Product[];
    return products
      .map((product) => ({ product, score: scoreProductMatch(product, query) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.product)
      .slice(0, 6);
  }, [liveQuery, products]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!searchBoxRef.current) return;
      if (!searchBoxRef.current.contains(event.target as Node)) {
        setSuggestionsOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
        <div ref={searchBoxRef} className="relative grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <input
              value={liveQuery}
              onFocus={() => setSuggestionsOpen(true)}
              onChange={(event) => {
                setLiveQuery(event.target.value);
                setSuggestionsOpen(true);
              }}
              placeholder="Search products"
              className="h-11 w-full border border-zinc-300 px-3 pr-12 text-sm uppercase tracking-[0.08em]"
            />
            {liveQuery ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 border border-zinc-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
                onClick={() => {
                  setLiveQuery("");
                  setQ("");
                  setSuggestionsOpen(false);
                }}
              >
                Clear
              </button>
            ) : null}

            {suggestionsOpen && liveQuery.trim().length >= 2 ? (
            <div className="absolute left-0 right-0 top-12 z-20 border border-zinc-300 bg-white">
              {suggestions.length ? (
                suggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="grid w-full grid-cols-[1fr_auto] border-b border-zinc-200 px-3 py-2 text-left text-sm hover:bg-zinc-50"
                    onClick={() => {
                      setSuggestionsOpen(false);
                      router.push(`/product/${item.slug}`);
                    }}
                  >
                    <span className="uppercase tracking-[0.08em]">{item.name}</span>
                    <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{item.topCategory}</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-3 text-sm text-zinc-600">No results found.</p>
              )}
            </div>
          ) : null}
          </div>

          <button
            type="button"
            className="h-11 border border-black px-4 text-xs font-semibold uppercase tracking-[0.12em]"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            {filtersOpen ? "Hide Filters" : "Filters"}
          </button>
        </div>

        {filtersOpen ? (
          <div className="grid gap-2 border border-zinc-300 p-3 sm:grid-cols-2 lg:grid-cols-5">
            <select className="h-10 border border-zinc-300 px-2 text-xs uppercase" value={topCategory} onChange={(event) => setTopCategory(event.target.value)}>
              <option value="">Gender</option>
              {topCategoryOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select className="h-10 border border-zinc-300 px-2 text-xs uppercase" value={effectiveProductType} onChange={(event) => setProductType(event.target.value)}>
              <option value="">Type</option>
              {productTypeOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select className="h-10 border border-zinc-300 px-2 text-xs uppercase" value={effectiveSubCategory} onChange={(event) => setSubCategory(event.target.value)}>
              <option value="">Subcategory</option>
              {subCategoryOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select className="h-10 border border-zinc-300 px-2 text-xs uppercase" value={effectiveSize} onChange={(event) => setSize(event.target.value)}>
              <option value="">Size</option>
              {sizeOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select className="h-10 border border-zinc-300 px-2 text-xs uppercase" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
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
        ) : null}
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
