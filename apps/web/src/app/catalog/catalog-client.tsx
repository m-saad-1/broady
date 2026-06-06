"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/ui/product-card";
import { getForYouRecommendationFeed, trackUserBehaviorEvent, type RecommendationMeta } from "@/lib/api";
import { getProductPricing } from "@/lib/pricing";
import { blendRecommendedProducts } from "@/lib/recommendation-mix";
import { useStableNow } from "@/hooks/use-stable-now";
import { useAuthStore } from "@/stores/auth-store";
import {
  filterProductsBySearchQuery,
} from "@/lib/search-fallback";
import { fallbackProducts } from "../../lib/mock-data";
import { getTopCategoryLabel, normalizeProduct } from "@/lib/taxonomy";
import type { Product } from "@/types/marketplace";
import {
  CATALOG_TOP_CATEGORY_OPTIONS,
  expandCatalogTopCategory,
  JUNIOR_TOP_CATEGORIES,
} from "@broady/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type CatalogClientProps = {
  initialProducts: Product[];
  allProducts: Product[];
  params: Record<string, string>;
};

const SORT_OPTIONS = [
  { value: "latest", label: "Latest" },
  { value: "featured", label: "Featured" },
  { value: "name", label: "A-Z" },
  { value: "price-asc", label: "Price Low to High" },
  { value: "price-desc", label: "Price High to Low" },
] as const;

const BROAD_PRODUCT_TYPE_VALUES = new Set(["top", "bottom", "footwear", "accessories"]);
const DEFAULT_CATALOG_OPTIONS_LIMIT = "5000";

function normalizeFilterValue(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function getInitialSubCategoryParam(params: Record<string, string>) {
  const requestedType = params.subCategory || params.type || "";
  if (requestedType) return requestedType;

  const legacyProductType = params.productType || "";
  return BROAD_PRODUCT_TYPE_VALUES.has(normalizeFilterValue(legacyProductType)) ? "" : legacyProductType;
}

function getProductSubCategoryValue(product: Product) {
  return product.subCategory?.trim() || "";
}

function productMatchesGenderScope(
  product: Product,
  topCategory: string,
  juniorCategory: string,
  selectedTopCategoryValues: string[],
) {
  if (!topCategory) return true;

  const productGender = normalizeFilterValue(product.gender);
  const productTopCategory = normalizeFilterValue(product.topCategory);
  const productJuniorGroup = normalizeFilterValue(product.juniorsGroup);

  if (topCategory === "Juniors") {
    if (juniorCategory) {
      const selectedJunior = normalizeFilterValue(juniorCategory);
      return productTopCategory === selectedJunior || productJuniorGroup === selectedJunior;
    }

    return productGender === "juniors" || selectedTopCategoryValues.includes(productTopCategory);
  }

  const selectedGender = normalizeFilterValue(topCategory);
  return productGender === selectedGender || productTopCategory === selectedGender;
}

function productMatchesSelectedSubCategory(product: Product, selectedSubCategory: string) {
  if (!selectedSubCategory) return true;
  return normalizeFilterValue(getProductSubCategoryValue(product)) === normalizeFilterValue(selectedSubCategory);
}


function isFeaturedProduct(product: Product) {
  return (
    product.badge === "New" ||
    product.badge === "Limited" ||
    Boolean(product.salePrice != null) ||
    Boolean(product.discountPercentage != null && product.discountPercentage > 0)
  );
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
      const normalizedTopValues = topCategoryValues.map(normalizeFilterValue);
      normalized = normalized.filter((product) =>
        productMatchesGenderScope(product, params.topCategory || "", params.juniorCategory || "", normalizedTopValues),
      );
    }
    if (params.q) {
      normalized = filterProductsBySearchQuery(normalized, params.q).map((product) => ({
        ...product,
      }));
    }
    if (params.subCategory)
      normalized = normalized.filter(
        (product) => productMatchesSelectedSubCategory(product, params.subCategory || ""),
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

function buildStableParamsKey(params: Record<string, string>) {
  return new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value)
      .sort(([a], [b]) => a.localeCompare(b)),
  ).toString();
}

function normalizeSortValue(value?: string) {
  return SORT_OPTIONS.some((option) => option.value === value)
    ? (value as (typeof SORT_OPTIONS)[number]["value"])
    : "latest";
}

function deriveCatalogStateFromParams(params: Record<string, string>) {
  return {
    query: params.q || "",
    correctedFrom: params.correctedFrom || "",
    topCategory: params.topCategory || "",
    juniorCategory: params.juniorCategory || "",
    subCategory: getInitialSubCategoryParam(params),
    size: params.size || "",
    sort: normalizeSortValue(params.sort),
  };
}

function mergeProductsByIdentity(...groups: Product[][]) {
  const byKey = new Map<string, Product>();

  for (const group of groups) {
    for (const product of group) {
      const key = product.id || product.slug;
      if (!key || byKey.has(key)) continue;
      byKey.set(key, product);
    }
  }

  return Array.from(byKey.values());
}

export function CatalogClient({ initialProducts, allProducts, params }: CatalogClientProps) {
  const router = useRouter();
  const now = useStableNow();
  const user = useAuthStore((state) => state.user);
  const paramsKey = useMemo(() => buildStableParamsKey(params), [params]);
  const paramsState = useMemo(() => deriveCatalogStateFromParams(params), [params]);
  const initialQueryKeyString = useMemo(() => {
    const p: Record<string, string> = {};
    if (paramsState.query) p.q = paramsState.query;
    if (paramsState.correctedFrom) p.correctedFrom = paramsState.correctedFrom;
    if (paramsState.topCategory) p.topCategory = paramsState.topCategory;
    if (paramsState.juniorCategory) p.juniorCategory = paramsState.juniorCategory;
    if (paramsState.subCategory) p.subCategory = paramsState.subCategory;
    if (paramsState.size) p.size = paramsState.size;
    if (paramsState.sort) p.sort = paramsState.sort;
    return buildStableParamsKey(p);
  }, [paramsState]);

  const [query, setQuery] = useState(paramsState.query);
  const [correctedFrom, setCorrectedFrom] = useState(paramsState.correctedFrom);
  const [topCategory, setTopCategory] = useState(paramsState.topCategory);
  const [juniorCategory, setJuniorCategory] = useState(paramsState.juniorCategory);
  const [subCategory, setSubCategory] = useState(paramsState.subCategory);
  const [size, setSize] = useState(paramsState.size);
  const [sort, setSort] = useState(paramsState.sort);
  const [catalogRecommendations, setCatalogRecommendations] = useState<Product[]>([]);
  const [catalogRecommendationMeta, setCatalogRecommendationMeta] = useState<RecommendationMeta | undefined>();

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setQuery(paramsState.query);
      setCorrectedFrom(paramsState.correctedFrom);
      setTopCategory(paramsState.topCategory);
      setJuniorCategory(paramsState.juniorCategory);
      setSubCategory(paramsState.subCategory);
      setSize(paramsState.size);
      setSort(paramsState.sort);
    }, 0);

    return () => window.clearTimeout(handle);
  }, [paramsKey, paramsState]);

  const selectedTopCategoryValues = useMemo(() => {
    return expandCatalogTopCategory(topCategory, juniorCategory).map(normalizeFilterValue);
  }, [topCategory, juniorCategory]);

  const activeParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (query) p.q = query;
    if (correctedFrom) p.correctedFrom = correctedFrom;
    if (topCategory) p.topCategory = topCategory;
    if (juniorCategory) p.juniorCategory = juniorCategory;
    if (subCategory) p.subCategory = subCategory;
    if (size) p.size = size;
    if (sort) p.sort = sort;
    return p;
  }, [correctedFrom, query, topCategory, juniorCategory, subCategory, size, sort]);

  // Create a stable string key for React Query to properly detect filter changes
  const queryKeyString = useMemo(() => buildStableParamsKey(activeParams) || "all", [activeParams]);

  const { data: productsData, isLoading, isFetching } = useQuery({
    queryKey: ["products", queryKeyString],
    queryFn: () => fetchProducts(activeParams),
    initialData: queryKeyString === initialQueryKeyString || (queryKeyString === "all" && !initialQueryKeyString) ? initialProducts : undefined,
    refetchOnWindowFocus: false,
  });
  const products = useMemo(() => productsData || [], [productsData]);
  const productsUpdating = isLoading || (isFetching && !productsData);

  const { data: catalogOptions = allProducts } = useQuery({
    queryKey: ["catalog-options"],
    queryFn: () => fetchProducts({ sort: "latest", limit: DEFAULT_CATALOG_OPTIONS_LIMIT }),
    initialData: allProducts,
    refetchOnWindowFocus: false,
  });

  const optionSource = useMemo(() => {
    const availableProducts = mergeProductsByIdentity(catalogOptions, allProducts, initialProducts);
    return availableProducts.length ? availableProducts : fallbackProducts.map(normalizeProduct);
  }, [allProducts, catalogOptions, initialProducts]);

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
    } catch {
      router.push(buildUrl(activeParams));
    }
  }, [activeParams, router]);

  const filteredProducts = useMemo(() => {
    const items = products.filter((product) => {
      if (!productMatchesGenderScope(product, topCategory, juniorCategory, selectedTopCategoryValues)) {
        return false;
      }

      if (!productMatchesSelectedSubCategory(product, subCategory)) {
        return false;
      }

      if (size && !product.sizes.some((entry) => entry.toLowerCase() === size.toLowerCase())) {
        return false;
      }

      return true;
    });

    if (sort === "price-asc") {
      items.sort((a, b) => getProductPricing(a, now).finalPrice - getProductPricing(b, now).finalPrice);
    } else if (sort === "price-desc") {
      items.sort((a, b) => getProductPricing(b, now).finalPrice - getProductPricing(a, now).finalPrice);
    } else if (sort === "name") {
      items.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "featured") {
      items.sort((a, b) => (isFeaturedProduct(b) ? 1 : 0) - (isFeaturedProduct(a) ? 1 : 0));
    }

    return items;
  }, [products, sort, now, selectedTopCategoryValues, topCategory, juniorCategory, subCategory, size]);

  const scopedCatalogRecommendations = useMemo(() => {
    let items = catalogRecommendations.filter((product) => {
      if (!productMatchesGenderScope(product, topCategory, juniorCategory, selectedTopCategoryValues)) {
        return false;
      }

      if (!productMatchesSelectedSubCategory(product, subCategory)) {
        return false;
      }

      if (size && !product.sizes.some((entry) => entry.toLowerCase() === size.toLowerCase())) {
        return false;
      }

      return true;
    });

    if (query.trim().length >= 2) {
      items = filterProductsBySearchQuery(items, query);
    }

    return items;
  }, [catalogRecommendations, query, selectedTopCategoryValues, topCategory, juniorCategory, subCategory, size]);

  const displayedProducts = useMemo(() => {
    if (!scopedCatalogRecommendations.length) return filteredProducts;

    return blendRecommendedProducts({
      recommended: scopedCatalogRecommendations,
      products: filteredProducts,
      limit: Math.max(filteredProducts.length, scopedCatalogRecommendations.length),
      recommendedSlots: 2,
      organicSlots: 1,
    });
  }, [filteredProducts, scopedCatalogRecommendations]);

  const recommendedCatalogProductIds = useMemo(
    () => new Set(scopedCatalogRecommendations.map((product) => product.id)),
    [scopedCatalogRecommendations],
  );

  const handleTopCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setTopCategory(value);
    setJuniorCategory("");
    setSubCategory("");
    setSize("");
  };

  const handleJuniorCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setJuniorCategory(value);
    setSubCategory("");
    setSize("");
    if (value) {
      setTopCategory("Juniors");
    }
  };

  const handleSubCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSubCategory(e.target.value);
    setSize("");
  };

  const availableProductTypes = useMemo(() => {
    const byValue = new Map<string, string>();

    optionSource.forEach((product) => {
      if (!productMatchesGenderScope(product, topCategory, juniorCategory, selectedTopCategoryValues)) {
        return;
      }

      const type = getProductSubCategoryValue(product);
      if (!type) return;

      const normalized = normalizeFilterValue(type);
      if (!byValue.has(normalized)) {
        byValue.set(normalized, type);
      }
    });

    return Array.from(byValue.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [optionSource, selectedTopCategoryValues, topCategory, juniorCategory]);

  // Get available sizes based on current filters
  const availableSizes = useMemo(() => {
    const matching = optionSource.filter((p) => {
      if (!productMatchesGenderScope(p, topCategory, juniorCategory, selectedTopCategoryValues)) {
        return false;
      }
      if (!productMatchesSelectedSubCategory(p, subCategory)) return false;
      return true;
    });

    const sizes: string[] = [];
    matching.forEach((p) => {
      if (p.sizes) sizes.push(...p.sizes);
    });

    return [...new Set(sizes)].sort();
  }, [optionSource, selectedTopCategoryValues, topCategory, juniorCategory, subCategory]);

  const clearFilters = () => {
    setQuery("");
    setCorrectedFrom("");
    setTopCategory("");
    setJuniorCategory("");
    setSubCategory("");
    setSize("");
    setSort("latest");
  };

  useEffect(() => {
    let active = true;
    const recommendationTopCategory = juniorCategory || (topCategory && topCategory !== "Juniors" ? topCategory : undefined);

    getForYouRecommendationFeed({
      limit: 48,
      topCategory: recommendationTopCategory || undefined,
      subCategory: subCategory || undefined,
    })
      .then((feed) => {
        if (!active) return;
        setCatalogRecommendations(feed.products);
        setCatalogRecommendationMeta(feed.products.length ? feed.meta : undefined);
      })
      .catch(() => {
        if (!active) return;
        setCatalogRecommendations([]);
        setCatalogRecommendationMeta(undefined);
      });

    return () => {
      active = false;
    };
  }, [juniorCategory, subCategory, topCategory, user?.id]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return;

    const handle = window.setTimeout(() => {
      void trackUserBehaviorEvent({
        eventType: "SEARCH_QUERY",
        searchQuery: normalizedQuery,
        sourcePage: "catalog",
        topCategory: juniorCategory || topCategory || undefined,
        subCategory: subCategory || undefined,
        metadata: {
          source: "catalog",
          resultCount: filteredProducts.length,
          correctedFrom: correctedFrom || undefined,
        },
      }).catch(() => {
        // Search telemetry should never interrupt filtering.
      });
    }, 600);

    return () => window.clearTimeout(handle);
  }, [correctedFrom, filteredProducts.length, juniorCategory, query, subCategory, topCategory]);

  useEffect(() => {
    const trackedTopCategory = juniorCategory || topCategory;
    if (!trackedTopCategory && !subCategory) return;

    const handle = window.setTimeout(() => {
      void trackUserBehaviorEvent({
        eventType: "CATEGORY_BROWSE",
        sourcePage: "catalog",
        topCategory: trackedTopCategory || undefined,
        subCategory: subCategory || undefined,
        metadata: {
          source: "catalog",
          resultCount: filteredProducts.length,
        },
      }).catch(() => {
        // Browse telemetry should never interrupt filtering.
      });
    }, 600);

    return () => window.clearTimeout(handle);
  }, [filteredProducts.length, juniorCategory, subCategory, topCategory]);

  useEffect(() => {
    const filters: Record<string, string> = {};
    if (topCategory) filters.topCategory = topCategory;
    if (juniorCategory) filters.juniorCategory = juniorCategory;
    if (subCategory) filters.subCategory = subCategory;
    if (size) filters.size = size;
    if (sort && sort !== "latest") filters.sort = sort;
    if (!Object.keys(filters).length) return;

    const handle = window.setTimeout(() => {
      void trackUserBehaviorEvent({
        eventType: "FILTER_USED",
        filters,
        sourcePage: "catalog",
        topCategory: juniorCategory || topCategory || undefined,
        subCategory: subCategory || undefined,
        metadata: {
          resultCount: filteredProducts.length,
        },
      }).catch(() => {
        // Filter telemetry should never interrupt catalog browsing.
      });
    }, 600);

    return () => window.clearTimeout(handle);
  }, [filteredProducts.length, juniorCategory, size, sort, subCategory, topCategory]);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-heading text-5xl uppercase">Product Grid</h1>
        {correctedFrom && query ? (
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
            Showing results for {query}
          </p>
        ) : null}
      </div>

      {/* Filters Bar - Matches brand collection style */}
      <div className="border border-zinc-300 p-3">
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

          {/* Product Type Filter */}
          <>
            <span className="text-zinc-400">/</span>
            <div className="flex items-center gap-2">
              <select
                value={subCategory}
                onChange={handleSubCategoryChange}
                className="h-9 border border-zinc-300 bg-white px-2 font-medium"
              >
                <option value="">Type</option>
                {availableProductTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </>

          {/* Size Filter - Dynamic based on current filters */}
          <>
            <span className="text-zinc-400">/</span>
            <div className="flex items-center gap-2">
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="h-9 border border-zinc-300 bg-white px-2 font-medium"
                disabled={!availableSizes.length}
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

          {/* Sort Filter */}
          <>
            <span className="text-zinc-400">/</span>
            <div className="flex items-center gap-2">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as (typeof SORT_OPTIONS)[number]["value"])}
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
      <section className="space-y-4">
        {productsUpdating ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="animate-pulse space-y-3 rounded-lg bg-zinc-200 p-4">
                <div className="h-48 rounded bg-zinc-300"></div>
                <div className="h-6 w-3/4 rounded bg-zinc-300"></div>
                <div className="h-4 w-1/2 rounded bg-zinc-300"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {displayedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                recommendationMeta={recommendedCatalogProductIds.has(product.id) ? catalogRecommendationMeta : undefined}
                source="catalog"
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
