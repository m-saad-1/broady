"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/ui/product-card";
import { getCatalogFilterOptions, getForYouRecommendationFeed, getProducts, trackUserBehaviorEvent, type RecommendationMeta } from "@/lib/api";
import { blendRecommendedProducts } from "@/lib/recommendation-mix";
import { useAuthStore } from "@/stores/auth-store";
import { normalizeApiCategoryFilterValue, normalizeCatalogCategoryFilterValue, normalizeProduct } from "@/lib/taxonomy";
import type { Product } from "@/types/marketplace";

type CatalogClientProps = {
  initialProducts: Product[];
  params: Record<string, string>;
};

const SORT_OPTIONS = [
  { value: "latest", label: "Latest" },
  { value: "featured", label: "Featured" },
  { value: "name", label: "A-Z" },
  { value: "price-asc", label: "Price Low to High" },
  { value: "price-desc", label: "Price High to Low" },
] as const;

function buildStableParamsKey(params: Record<string, string>) {
  return new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value)
      .sort(([a], [b]) => a.localeCompare(b)),
  ).toString();
}

function buildUrl(params: Record<string, string>) {
  const search = new URLSearchParams(params).toString();
  return `/catalog${search ? `?${search}` : ""}`;
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
    brandId: params.brandId || params.brand || "",
    division: params.division || "",
    category: params.category ? normalizeApiCategoryFilterValue(params.category) : "",
    subType: params.subType || "",
    size: params.size || "",
    color: params.color || "",
    minPrice: params.minPrice || "",
    maxPrice: params.maxPrice || "",
    sort: normalizeSortValue(params.sort),
  };
}

export function CatalogClient({ initialProducts, params }: CatalogClientProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const paramsState = useMemo(() => deriveCatalogStateFromParams(params), [params]);
  const paramsKey = useMemo(() => buildStableParamsKey(params), [params]);

  const [query, setQuery] = useState(paramsState.query);
  const [correctedFrom, setCorrectedFrom] = useState(paramsState.correctedFrom);
  const [topCategory, setTopCategory] = useState(paramsState.topCategory);
  const [juniorCategory, setJuniorCategory] = useState(paramsState.juniorCategory);
  const [brandId, setBrandId] = useState(paramsState.brandId);
  const [division, setDivision] = useState(paramsState.division);
  const [category, setCategory] = useState(paramsState.category);
  const [subType, setSubType] = useState(paramsState.subType);
  const [size, setSize] = useState(paramsState.size);
  const [color, setColor] = useState(paramsState.color);
  const [minPrice, setMinPrice] = useState(paramsState.minPrice);
  const [maxPrice, setMaxPrice] = useState(paramsState.maxPrice);
  const [sort, setSort] = useState(paramsState.sort);
  const [catalogRecommendations, setCatalogRecommendations] = useState<Product[]>([]);
  const [catalogRecommendationMeta, setCatalogRecommendationMeta] = useState<RecommendationMeta | undefined>();

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setQuery(paramsState.query);
      setCorrectedFrom(paramsState.correctedFrom);
      setTopCategory(paramsState.topCategory);
      setJuniorCategory(paramsState.juniorCategory);
      setBrandId(paramsState.brandId);
      setDivision(paramsState.division);
      setCategory(paramsState.category);
      setSubType(paramsState.subType);
      setSize(paramsState.size);
      setColor(paramsState.color);
      setMinPrice(paramsState.minPrice);
      setMaxPrice(paramsState.maxPrice);
      setSort(paramsState.sort);
    }, 0);

    return () => window.clearTimeout(handle);
  }, [paramsKey, paramsState]);

  const activeParams = useMemo(() => {
    const next: Record<string, string> = {};
    if (query) next.q = query;
    if (correctedFrom) next.correctedFrom = correctedFrom;
    if (topCategory) next.topCategory = topCategory;
    if (juniorCategory) next.juniorCategory = juniorCategory;
    if (brandId) next.brandId = brandId;
    if (division) next.division = division;
    if (category) next.category = category;
    if (subType) next.subType = subType;
    if (size) next.size = size;
    if (color) next.color = color;
    if (minPrice) next.minPrice = minPrice;
    if (maxPrice) next.maxPrice = maxPrice;
    if (sort) next.sort = sort;
    return next;
  }, [brandId, category, color, correctedFrom, division, juniorCategory, maxPrice, minPrice, query, size, sort, subType, topCategory]);

  const queryKeyString = useMemo(() => buildStableParamsKey(activeParams) || "all", [activeParams]);

  const { data: productsData, isLoading, isFetching } = useQuery({
    queryKey: ["products", queryKeyString],
    queryFn: () => getProducts({ ...activeParams, limit: "100" }),
    initialData: initialProducts.map(normalizeProduct),
    refetchOnWindowFocus: false,
  });

  const filterOptionParams = useMemo(() => {
    const next: Record<string, string> = {};
    if (topCategory) next.topCategory = topCategory;
    if (juniorCategory) next.juniorCategory = juniorCategory;
    if (brandId) next.brandId = brandId;
    if (division) next.division = division;
    if (category) next.category = category;
    if (subType) next.subType = subType;
    if (size) next.size = size;
    if (color) next.color = color;
    if (minPrice) next.minPrice = minPrice;
    if (maxPrice) next.maxPrice = maxPrice;
    return next;
  }, [brandId, category, color, division, juniorCategory, maxPrice, minPrice, size, subType, topCategory]);

  const { data: filterOptions } = useQuery({
    queryKey: ["product-filter-options", buildStableParamsKey(filterOptionParams) || "all"],
    queryFn: () => getCatalogFilterOptions(filterOptionParams),
    refetchOnWindowFocus: false,
  });

  const products = useMemo(() => (productsData || []).map(normalizeProduct), [productsData]);
  const productsUpdating = isLoading || (isFetching && !productsData);

  useEffect(() => {
    try {
      const url = buildUrl(activeParams);
      if (typeof window !== "undefined" && window.history?.replaceState) {
        window.history.replaceState({}, "", url);
      } else {
        router.push(url);
      }
    } catch {
      router.push(buildUrl(activeParams));
    }
  }, [activeParams, router]);

  useEffect(() => {
    let active = true;
    const recommendationTopCategory = juniorCategory || (topCategory && topCategory !== "Juniors" ? topCategory : undefined);

    getForYouRecommendationFeed({
      limit: 24,
      topCategory: recommendationTopCategory || undefined,
      subCategory: category ? normalizeCatalogCategoryFilterValue(category) : undefined,
    })
      .then((feed) => {
        if (!active) return;
        setCatalogRecommendations(feed.products.map(normalizeProduct));
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
  }, [category, juniorCategory, topCategory, user?.id]);

  const displayedProducts = useMemo(() => {
    if (!catalogRecommendations.length) return products;
    return blendRecommendedProducts({
      products,
      recommended: catalogRecommendations,
      limit: products.length || 24,
      recommendedSlots: 2,
      organicSlots: 2,
    });
  }, [catalogRecommendations, products]);

  const recommendedCatalogProductIds = useMemo(
    () => new Set(catalogRecommendations.map((product) => product.id)),
    [catalogRecommendations],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (query.trim().length >= 2) {
        void trackUserBehaviorEvent({
          eventType: "SEARCH_QUERY",
          searchQuery: query.trim(),
          sourcePage: "catalog",
          topCategory: juniorCategory || topCategory || undefined,
          subCategory: category || undefined,
          metadata: { resultCount: products.length, correctedFrom: correctedFrom || undefined },
        }).catch(() => undefined);
      }
    }, 500);
    return () => window.clearTimeout(handle);
  }, [category, correctedFrom, juniorCategory, products.length, query, topCategory]);

  useEffect(() => {
    const filters: Record<string, string> = {};
    if (brandId) filters.brandId = brandId;
    if (division) filters.division = division;
    if (category) filters.category = category;
    if (subType) filters.subType = subType;
    if (size) filters.size = size;
    if (color) filters.color = color;
    if (minPrice) filters.minPrice = minPrice;
    if (maxPrice) filters.maxPrice = maxPrice;
    if (!Object.keys(filters).length) return;

    const handle = window.setTimeout(() => {
      void trackUserBehaviorEvent({
        eventType: "FILTER_USED",
        filters,
        sourcePage: "catalog",
        topCategory: juniorCategory || topCategory || undefined,
        subCategory: category || undefined,
        metadata: { resultCount: products.length },
      }).catch(() => undefined);
    }, 500);

    return () => window.clearTimeout(handle);
  }, [brandId, category, color, division, juniorCategory, maxPrice, minPrice, products.length, size, subType, topCategory]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (division && filterOptions && !filterOptions.divisions.includes(division)) setDivision("");
      if (category && filterOptions && !filterOptions.categories.includes(category)) setCategory("");
      if (subType && filterOptions && !filterOptions.subTypes.includes(subType)) setSubType("");
      if (size && filterOptions && !filterOptions.sizes.includes(size)) setSize("");
      if (color && filterOptions && !filterOptions.colors.includes(color)) setColor("");
    }, 0);

    return () => window.clearTimeout(handle);
  }, [category, color, division, filterOptions, size, subType]);

  const clearFilters = () => {
    setQuery("");
    setCorrectedFrom("");
    setBrandId("");
    setDivision("");
    setCategory("");
    setSubType("");
    setSize("");
    setColor("");
    setMinPrice("");
    setMaxPrice("");
    setSort("latest");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select value={brandId} onChange={(event) => setBrandId(event.target.value)} className="h-9 border border-zinc-300 bg-white px-2 text-sm">
            <option value="">Brand</option>
            {(filterOptions?.brands || []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <select value={division} onChange={(event) => { setDivision(event.target.value); setCategory(""); setSubType(""); }} className="h-9 border border-zinc-300 bg-white px-2 text-sm">
            <option value="">Division</option>
            {(filterOptions?.divisions || []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select value={category} onChange={(event) => { setCategory(event.target.value); setSubType(""); }} className="h-9 border border-zinc-300 bg-white px-2 text-sm">
            <option value="">Category</option>
            {(filterOptions?.categories || []).map((item) => (
              <option key={item} value={item}>
                {normalizeCatalogCategoryFilterValue(item)}
              </option>
            ))}
          </select>

          {(filterOptions?.subTypes?.length || 0) > 0 ? (
            <select value={subType} onChange={(event) => setSubType(event.target.value)} className="h-9 border border-zinc-300 bg-white px-2 text-sm">
              <option value="">Sub-type</option>
              {(filterOptions?.subTypes || []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          ) : null}

          <select value={size} onChange={(event) => setSize(event.target.value)} className="h-9 border border-zinc-300 bg-white px-2 text-sm" disabled={!(filterOptions?.sizes || []).length}>
            <option value="">Size</option>
            {(filterOptions?.sizes || []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select value={color} onChange={(event) => setColor(event.target.value)} className="h-9 border border-zinc-300 bg-white px-2 text-sm" disabled={!(filterOptions?.colors || []).length}>
            <option value="">Color</option>
            {(filterOptions?.colors || []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <input value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder={`Min ${filterOptions?.priceRange.min ?? 0}`} className="h-9 w-24 border border-zinc-300 px-2 text-sm" inputMode="numeric" />
          <input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder={`Max ${filterOptions?.priceRange.max ?? 0}`} className="h-9 w-24 border border-zinc-300 px-2 text-sm" inputMode="numeric" />

          <select value={sort} onChange={(event) => setSort(event.target.value as (typeof SORT_OPTIONS)[number]["value"])} className="h-9 border border-zinc-300 bg-white px-2 text-sm">
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button type="button" onClick={clearFilters} className="h-9 border border-zinc-300 px-3 text-sm">
            Clear All
          </button>
        </div>
      </div>

      <section className="space-y-4">
        <div className="space-y-1">
          <h1 className="font-heading text-5xl uppercase">Product Grid</h1>
          {correctedFrom && query ? (
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Showing results for {query}</p>
          ) : null}
        </div>

        {productsUpdating ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="space-y-3 rounded border border-zinc-200 p-4">
                <div className="h-48 animate-pulse bg-zinc-200"></div>
                <div className="h-5 animate-pulse bg-zinc-200"></div>
                <div className="h-4 w-2/3 animate-pulse bg-zinc-200"></div>
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
