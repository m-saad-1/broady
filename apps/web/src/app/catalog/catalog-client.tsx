"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/ui/product-card";
import { getProductPricing } from "@/lib/pricing";
import { useStableNow } from "@/hooks/use-stable-now";
import {
  filterProductsBySubCategoryContains,
  isEligibleSearchQuery,
  normalizeSearchQuery,
} from "@/lib/search-fallback";
import { fallbackProducts } from "../../lib/mock-data";
import { getTopCategoryLabel, inferProductType, normalizeProduct } from "@/lib/taxonomy";
import type { Product } from "@/types/marketplace";
import {
  CATALOG_TOP_CATEGORY_OPTIONS,
  expandCatalogTopCategory,
  isJuniorTopCategory,
  JUNIOR_TOP_CATEGORIES,
  PRODUCT_TYPE_OPTIONS,
} from "@broady/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type CatalogClientProps = {
  initialProducts: Product[];
  allProducts: Product[];
  params: Record<string, string>;
};

const SORT_OPTIONS = [
  { value: "latest", label: "Latest" },
  { value: "price-asc", label: "Price Low" },
  { value: "price-desc", label: "Price High" },
  { value: "name", label: "Name A-Z" },
  { value: "featured", label: "Featured" },
  { value: "in-stock", label: "In Stock" },
] as const;

function isFeaturedProduct(product: Product) {
  return (
    product.badge === "New" ||
    product.badge === "Limited" ||
    Boolean(product.salePrice != null) ||
    Boolean(product.discountPercentage != null && product.discountPercentage > 0)
  );
}

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
    return json.data.map(normalizeProduct);
  } catch (e) {
    console.error("Catalog API fetch failed, using mock fallback:", e);
    // Basic fallback filtering for offline/demo mode
    let normalized = fallbackProducts.map(normalizeProduct);
    const topCategoryValues = expandCatalogTopCategory(params.topCategory, params.juniorCategory);
    if (topCategoryValues.length) {
      const normalizedTopValues = topCategoryValues.map((value) => value.toLowerCase());
      normalized = normalized.filter((product) => normalizedTopValues.includes(product.topCategory.toLowerCase()));
    }
    if (params.q) {
      normalized = normalized
        .map((product) => ({ product, score: scoreProductMatch(product, params.q || "") }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.product);
    }
    if (params.productType)
      normalized = normalized.filter(
        (product) => (product.productType || "").toLowerCase() === params.productType.toLowerCase(),
      );
    if (params.subCategory)
      normalized = normalized.filter(
        (product) => product.subCategory.toLowerCase() === params.subCategory?.toLowerCase(),
      );
    if (params.size)
      normalized = normalized.filter((product) =>
        product.sizes.some((entry) => entry.toLowerCase() === (params.size || "").toLowerCase()),
      );
    if (params.color)
      normalized = normalized.filter((p) => p.color?.toLowerCase().includes(params.color?.toLowerCase() ?? ""));
    return normalized;
  }
}

function buildUrl(params: Record<string, string>): string {
  const search = new URLSearchParams(params).toString();
  return `/catalog${search ? `?${search}` : ""}`;
}

export function CatalogClient({ initialProducts, allProducts, params }: CatalogClientProps) {
  const router = useRouter();
  const now = useStableNow();

  const [query, setQuery] = useState(params.q || "");
  const [topCategory, setTopCategory] = useState(params.topCategory || "");
  const [juniorCategory, setJuniorCategory] = useState(params.juniorCategory || "");
  const [productType, setProductType] = useState(params.productType || "");
  const [subCategory, setSubCategory] = useState(params.subCategory || "");
  const [size, setSize] = useState(params.size || "");
  const [sort, setSort] = useState((params.sort as (typeof SORT_OPTIONS)[number]["value"]) || "latest");

  const getEffectiveType = (product: Product) => {
    return inferProductType(product.subCategory || "T-Shirts").toLowerCase();
  };

  const selectedTopCategoryValues = useMemo(() => {
    return expandCatalogTopCategory(topCategory, juniorCategory).map((value) => value.toLowerCase());
  }, [topCategory, juniorCategory]);

  const activeParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (query) p.q = query;
    if (topCategory) p.topCategory = topCategory;
    if (juniorCategory) p.juniorCategory = juniorCategory;
    if (productType) p.productType = productType;
    if (subCategory) p.subCategory = subCategory;
    if (size) p.size = size;
    if (sort) p.sort = sort;
    return p;
  }, [query, topCategory, juniorCategory, productType, subCategory, size, sort]);

  // Create a stable string key for React Query to properly detect filter changes
  const queryKeyString = useMemo(() => {
    const parts: string[] = [];
    if (query) parts.push(`q=${encodeURIComponent(query)}`);
    if (topCategory) parts.push(`topCategory=${encodeURIComponent(topCategory)}`);
    if (juniorCategory) parts.push(`juniorCategory=${encodeURIComponent(juniorCategory)}`);
    if (productType) parts.push(`productType=${encodeURIComponent(productType)}`);
    if (subCategory) parts.push(`subCategory=${encodeURIComponent(subCategory)}`);
    if (size) parts.push(`size=${encodeURIComponent(size)}`);
    if (sort) parts.push(`sort=${encodeURIComponent(sort)}`);
    return parts.length > 0 ? parts.join("&") : "all";
  }, [query, topCategory, juniorCategory, productType, subCategory, size, sort]);

  const { data: products = initialProducts, isLoading } = useQuery({
    queryKey: ["products", queryKeyString],
    queryFn: () => fetchProducts(activeParams),
    initialData: initialProducts,
    refetchOnWindowFocus: false,
  });

  const { data: catalogOptions = initialProducts } = useQuery({
    queryKey: ["catalog-options"],
    queryFn: () => fetchProducts({ sort: "latest" }),
    initialData: allProducts,
    refetchOnWindowFocus: false,
  });

  const optionSource = useMemo(() => {
    if (catalogOptions.length) {
      return catalogOptions;
    }

    return fallbackProducts.map(normalizeProduct);
  }, [catalogOptions]);

  useEffect(() => {
    // Update the browser URL without triggering a server navigation so
    // the client component state is preserved and queries can refetch
    // in-place when filters change.
    try {
      const url = buildUrl(activeParams);
      if (typeof window !== "undefined" && window.history && window.history.replaceState) {
        window.history.replaceState({}, "", url);
      } else {
        // Fallback to router navigation for environments where history isn't available
        router.push(url);
      }
    } catch (e) {
      router.push(buildUrl(activeParams));
    }
  }, [activeParams, router]);

  const filteredProducts = useMemo(() => {
    let items = products.filter((product) => {
      if (selectedTopCategoryValues.length && !selectedTopCategoryValues.includes(product.topCategory.toLowerCase())) {
        return false;
      }

      if (productType && getEffectiveType(product) !== productType.toLowerCase()) {
        return false;
      }

      if (subCategory && product.subCategory.toLowerCase() !== subCategory.toLowerCase()) {
        return false;
      }

      if (size && !product.sizes.some((entry) => entry.toLowerCase() === size.toLowerCase())) {
        return false;
      }

      return true;
    });
    const normalizedQuery = normalizeSearchQuery(query);

    if (isEligibleSearchQuery(normalizedQuery)) {
      items = filterProductsBySubCategoryContains(items, normalizedQuery).sort(
        (a, b) => scoreProductMatch(b, normalizedQuery) - scoreProductMatch(a, normalizedQuery),
      );
    }

    if (sort === "price-asc") {
      items.sort((a, b) => getProductPricing(a, now).finalPrice - getProductPricing(b, now).finalPrice);
    } else if (sort === "price-desc") {
      items.sort((a, b) => getProductPricing(b, now).finalPrice - getProductPricing(a, now).finalPrice);
    } else if (sort === "name") {
      items.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "featured") {
      items.sort((a, b) => (isFeaturedProduct(b) ? 1 : 0) - (isFeaturedProduct(a) ? 1 : 0));
    } else if (sort === "in-stock") {
      items.sort((a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0));
    }

    return items;
  }, [products, query, sort, now, selectedTopCategoryValues, productType, subCategory, size]);

  const handleTopCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setTopCategory(value);
    setJuniorCategory("");
    setProductType("");
    setSubCategory("");
    setSize("");
  };

  const handleJuniorCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setJuniorCategory(value);
    setProductType("");
    setSubCategory("");
    setSize("");
    if (value) {
      setTopCategory("Juniors");
    }
  };

  const handleProductTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setProductType(e.target.value);
    setSubCategory("");
    setSize("");
  };

  // Get available subcategories based on selected type and gender
  const availableSubCategories = useMemo(() => {
    const matching = optionSource.filter((p) => {
      if (selectedTopCategoryValues.length && !selectedTopCategoryValues.includes(p.topCategory.toLowerCase())) {
        return false;
      }
      if (productType && getEffectiveType(p) !== productType.toLowerCase()) return false;
      return true;
    });

    const subCats = [...new Set(matching.map((p) => p.subCategory))];
    return subCats.sort();
  }, [optionSource, selectedTopCategoryValues, productType]);

  // Get available sizes based on current filters
  const availableSizes = useMemo(() => {
    const matching = optionSource.filter((p) => {
      if (selectedTopCategoryValues.length && !selectedTopCategoryValues.includes(p.topCategory.toLowerCase())) {
        return false;
      }
      if (productType && getEffectiveType(p) !== productType.toLowerCase()) return false;
      if (subCategory && p.subCategory.toLowerCase() !== subCategory.toLowerCase()) return false;
      return true;
    });

    const sizes: string[] = [];
    matching.forEach((p) => {
      if (p.sizes) sizes.push(...p.sizes);
    });

    return [...new Set(sizes)].sort();
  }, [optionSource, selectedTopCategoryValues, productType, subCategory]);

  const clearFilters = () => {
    setQuery("");
    setTopCategory("");
    setJuniorCategory("");
    setProductType("");
    setSubCategory("");
    setSize("");
    setSort("latest");
  };

  return (
    <div className="space-y-8">
      {/* Filters Bar - Matches brand collection style */}
      <div className="border border-zinc-300 p-4">
        <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.12em]">
          {/* Gender Filter */}
          <div className="flex items-center gap-2">
            <select
              value={topCategory}
              onChange={handleTopCategoryChange}
              className="h-9 border border-zinc-300 bg-white px-2 font-medium"
            >
              <option value="">Gender</option>
              {CATALOG_TOP_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {getTopCategoryLabel(opt)}
                </option>
              ))}
            </select>
          </div>

          {/* Junior Category Filter - Show only when Juniors is selected */}
          {topCategory === "Juniors" && (
            <>
              <span className="text-zinc-400">/</span>
              <div className="flex items-center gap-2">
                <select
                  value={juniorCategory}
                  onChange={handleJuniorCategoryChange}
                  className="h-9 border border-zinc-300 bg-white px-2 font-medium"
                >
                  <option value="">Junior Type</option>
                  {JUNIOR_TOP_CATEGORIES.map((opt) => (
                    <option key={opt} value={opt}>
                      {getTopCategoryLabel(opt)}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Type Filter */}
          <>
            <span className="text-zinc-400">/</span>
            <div className="flex items-center gap-2">
              <select
                value={productType}
                onChange={handleProductTypeChange}
                className="h-9 border border-zinc-300 bg-white px-2 font-medium"
              >
                <option value="">Type</option>
                {PRODUCT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </>

          {/* Subcategory Filter - Dynamic based on selected Type */}
          <>
            <span className="text-zinc-400">/</span>
            <div className="flex items-center gap-2">
              <select
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                className="h-9 border border-zinc-300 bg-white px-2 font-medium"
              >
                <option value="">Sub</option>
                {availableSubCategories.map((subCat) => (
                  <option key={subCat} value={subCat}>
                    {subCat}
                  </option>
                ))}
              </select>
            </div>
          </>

          {/* Size Filter - Dynamic based on current filters */}
          {availableSizes.length > 0 && (
            <>
              <span className="text-zinc-400">/</span>
              <div className="flex items-center gap-2">
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="h-9 border border-zinc-300 bg-white px-2 font-medium"
                >
                  <option value="">Size</option>
                  {availableSizes.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Sort Filter */}
          <>
            <span className="text-zinc-400">/</span>
            <div className="flex items-center gap-2">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="h-9 border border-zinc-300 bg-white px-2 font-medium"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </>

          {/* Clear Button */}
          <span className="text-zinc-400">|</span>
          <button
            onClick={clearFilters}
            className="text-zinc-600 hover:text-zinc-900 hover:underline"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Products Section */}
      <section>
        <div className="flex items-center justify-between border-b border-zinc-300 pb-4">
          <p className="text-sm text-zinc-600">
            Showing {filteredProducts.length} of {products.length} products
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 pt-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="animate-pulse space-y-3 rounded-lg bg-zinc-200 p-4">
                <div className="h-48 rounded bg-zinc-300"></div>
                <div className="h-6 w-3/4 rounded bg-zinc-300"></div>
                <div className="h-4 w-1/2 rounded bg-zinc-300"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 pt-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
