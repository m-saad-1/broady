"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { ProductCard } from "@/components/ui/product-card";
import { trackUserBehaviorEvent } from "@/lib/api";
import { getProductPricing } from "@/lib/pricing";
import { useStableNow } from "@/hooks/use-stable-now";
import { useMockFallback } from "@/lib/runtime-flags";
import {
  filterProductsBySubCategoryContains,
  isEligibleSearchQuery,
  normalizeSearchQuery,
} from "@/lib/search-fallback";
import { fallbackProducts } from "../../lib/mock-data";
import { getTopCategoryLabel, normalizeProduct } from "@/lib/taxonomy";
import { useAuthStore } from "@/stores/auth-store";
import type { Product } from "@/types/marketplace";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type CatalogClientProps = {
  initialProducts: Product[];
  params: Record<string, string>;
};

type ProductTypeFilter = "Top" | "Bottom" | "Footwear" | "Accessories";

const TOP_CATEGORY_OPTIONS = ["Men", "Women", "Kids"] as const;
const PRODUCT_TYPE_OPTIONS: ProductTypeFilter[] = ["Top", "Bottom", "Footwear", "Accessories"];
const JUNIOR_GROUP_OPTIONS = ["Toddler Boys", "Junior Boys", "Toddler Girls", "Junior Girls"] as const;
const SORT_OPTIONS = [
  { value: "latest", label: "Latest" },
  { value: "price-asc", label: "Price Low" },
  { value: "price-desc", label: "Price High" },
  { value: "name", label: "Name A-Z" },
  { value: "featured", label: "Featured" },
  { value: "in-stock", label: "In Stock" },
] as const;

type JuniorGroupFilter = (typeof JUNIOR_GROUP_OPTIONS)[number];

function isJuniorGroup(value: string): value is JuniorGroupFilter {
  return (JUNIOR_GROUP_OPTIONS as readonly string[]).includes(value);
}

function normalizeJuniorGroup(value?: string) {
  return value && isJuniorGroup(value) ? value : "";
}

function isFeaturedProduct(product: Product) {
  return product.badge === "New" || product.badge === "Limited" || Boolean(product.offer?.isActive);
}

function getJuniorGroup(product: Product) {
  const text = `${product.name} ${product.subCategory}`.toLowerCase();
  const hasJuniorSizes = product.sizes.some((size) => /^(8Y|10Y|12Y|14Y|16Y)$/.test(size.toUpperCase()));
  const age = hasJuniorSizes ? "Junior" : "Toddler";
  const gender = text.includes("girl") ? "Girls" : text.includes("boy") ? "Boys" : "";

  return gender ? `${age} ${gender}` : "";
}

function matchesJuniorGroup(product: Product, group: string) {
  if (!group) return true;
  return getJuniorGroup(product) === group;
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

function getMenuValueLabel(options: Array<{ value: string; label: string }>, value: string) {
  return options.find((opt) => opt.value === value)?.label || "Select";
}

export function CatalogClient({ initialProducts, params }: CatalogClientProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const lastSearchTrackedRef = useRef<string>("");
  const lastCategoryTrackedRef = useRef<string>("");
  const [topCategory, setTopCategory] = useState(params.topCategory || "");
  const [productType, setProductType] = useState(params.productType || "");
  const [subCategory, setSubCategory] = useState(params.subCategory || "");
  const [size, setSize] = useState(params.size || "");
  const [sortBy, setSortBy] = useState(params.sortBy || "latest");
  const [juniorGroup, setJuniorGroup] = useState<JuniorGroupFilter | "">(normalizeJuniorGroup(params.juniorGroup));
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const renderNow = useStableNow();

  const queryFromRoute = useMemo(() => params.q?.trim() || "", [params.q]);
  const normalizedQueryFromRoute = useMemo(() => normalizeSearchQuery(queryFromRoute), [queryFromRoute]);
  const normalizedInitialProducts = useMemo(() => initialProducts.map(normalizeProduct), [initialProducts]);
  const effectiveProductType = topCategory === "Kids" ? "" : productType && PRODUCT_TYPE_OPTIONS.includes(productType as ProductTypeFilter) ? productType : "";
  const hasActiveSearch = Boolean(normalizedQueryFromRoute);

  const facetParams = useMemo(() => {
    const next: Record<string, string> = {};
    if (queryFromRoute) next.q = queryFromRoute;
    if (topCategory) next.topCategory = topCategory;
    if (effectiveProductType) next.productType = effectiveProductType;
    return next;
  }, [effectiveProductType, queryFromRoute, topCategory]);

  const { data: products = initialProducts } = useQuery({
    queryKey: ["products", queryFromRoute, topCategory, effectiveProductType, subCategory, size, sortBy, juniorGroup],
    queryFn: () => fetchProducts({
      q: queryFromRoute,
      topCategory,
      productType: effectiveProductType,
      subCategory,
      size,
      sortBy,
      juniorGroup,
    }),
    initialData: initialProducts,
  });

  const { data: facetProducts = initialProducts } = useQuery({
    queryKey: ["products-facets", facetParams],
    queryFn: () => fetchProducts(facetParams),
    initialData: initialProducts,
  });

  const normalizedFacetProducts = useMemo(() => {
    const source = facetProducts.length ? facetProducts : initialProducts;
    return source.map(normalizeProduct);
  }, [facetProducts, initialProducts]);

  const facetTypeProducts = useMemo(() => {
    if (!effectiveProductType) return normalizedFacetProducts;
    return normalizedFacetProducts.filter((item) => item.productType === effectiveProductType);
  }, [effectiveProductType, normalizedFacetProducts]);

  const subCategoryOptions = useMemo(
    () => Array.from(new Set(facetTypeProducts.map((item) => item.subCategory))).sort(),
    [facetTypeProducts],
  );
  const effectiveSubCategory = topCategory === "Kids" ? "" : subCategory && subCategoryOptions.includes(subCategory) ? subCategory : "";

  const sizeSource = useMemo(() => {
    let next = normalizedFacetProducts;

    if (effectiveProductType) {
      next = next.filter((item) => item.productType === effectiveProductType);
    }

    if (effectiveSubCategory) {
      next = next.filter((item) => item.subCategory === effectiveSubCategory);
    }

    return next;
  }, [effectiveProductType, effectiveSubCategory, normalizedFacetProducts]);

  const sizeOptions = useMemo(() => Array.from(new Set(sizeSource.flatMap((item) => item.sizes))).sort(), [sizeSource]);
  const effectiveSize = topCategory === "Kids" ? "" : size && sizeOptions.includes(size) ? size : "";
  const effectiveJuniorGroup = topCategory === "Kids" && isJuniorGroup(juniorGroup) ? juniorGroup : "";

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

  const fallbackCatalogProducts = useMemo(() => {
    if (products.length > 0 || !isEligibleSearchQuery(normalizedQueryFromRoute)) {
      return [];
    }

    return filterProductsBySubCategoryContains(
      normalizedInitialProducts,
      normalizedQueryFromRoute,
    );
  }, [normalizedInitialProducts, normalizedQueryFromRoute, products.length]);

  const productsForRendering = products.length
    ? products
    : fallbackCatalogProducts;

  const normalizedRenderableProducts = useMemo(
    () => productsForRendering.map(normalizeProduct),
    [productsForRendering],
  );

  const filteredProducts = useMemo(() => {
    let next = [...normalizedRenderableProducts];

    if (sortBy === "featured") {
      next = next.filter(isFeaturedProduct);
    }

    if (sortBy === "in-stock") {
      next = next.filter((product) => product.stock > 0);
    }

    if (topCategory === "Kids") {
      next = next.filter((product) => matchesJuniorGroup(product, effectiveJuniorGroup));
    }

    return next;
  }, [effectiveJuniorGroup, normalizedRenderableProducts, sortBy, topCategory]);

  const orderedProducts = useMemo(() => {
    const copy = [...filteredProducts];
    if (sortBy === "price-asc") return copy.sort((a, b) => getProductPricing(a, renderNow).finalPrice - getProductPricing(b, renderNow).finalPrice);
    if (sortBy === "price-desc") return copy.sort((a, b) => getProductPricing(b, renderNow).finalPrice - getProductPricing(a, renderNow).finalPrice);
    if (sortBy === "name") return copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  }, [filteredProducts, renderNow, sortBy]);

  useEffect(() => {
    if (topCategory === "Kids") {
      return;
    }

    if (subCategory && !subCategoryOptions.includes(subCategory)) {
      setSubCategory("");
    }
  }, [subCategory, subCategoryOptions, topCategory]);

  useEffect(() => {
    if (topCategory === "Kids") {
      return;
    }

    if (size && !sizeOptions.includes(size)) {
      setSize("");
    }
  }, [size, sizeOptions, topCategory]);

  useEffect(() => {
    const next = new URLSearchParams(runtimeParams);
    const href = next.toString() ? `/catalog?${next.toString()}` : "/catalog";
    router.replace(href, { scroll: false });
  }, [router, runtimeParams]);

  useEffect(() => {
    if (!user) return;
    const query = queryFromRoute.trim();
    if (!query) return;

    const fingerprint = query.toLowerCase();
    if (lastSearchTrackedRef.current === fingerprint) return;
    lastSearchTrackedRef.current = fingerprint;

    void trackUserBehaviorEvent({
      eventType: "SEARCH_QUERY",
      searchQuery: query,
      topCategory: topCategory || undefined,
      subCategory: effectiveSubCategory || undefined,
      metadata: {
        source: "catalog",
        productType: effectiveProductType || undefined,
      },
    }).catch(() => {
      // Ignore telemetry failures.
    });
  }, [effectiveProductType, effectiveSubCategory, queryFromRoute, topCategory, user]);

  useEffect(() => {
    if (!user) return;
    if (!topCategory && !effectiveSubCategory) return;

    const fingerprint = [topCategory || "", effectiveSubCategory || "", effectiveProductType || ""].join("|").toLowerCase();
    if (lastCategoryTrackedRef.current === fingerprint) return;
    lastCategoryTrackedRef.current = fingerprint;

    void trackUserBehaviorEvent({
      eventType: "CATEGORY_BROWSE",
      topCategory: topCategory || undefined,
      subCategory: effectiveSubCategory || undefined,
      metadata: {
        source: "catalog",
        productType: effectiveProductType || undefined,
      },
    }).catch(() => {
      // Ignore telemetry failures.
    });
  }, [effectiveProductType, effectiveSubCategory, topCategory, user]);

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
                setJuniorGroup("");
                router.replace("/catalog", { scroll: false });
              }}
              aria-label="Clear active search"
              title="Clear search"
            >
              ×
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <DropdownMenu
            title="Gender"
            value={topCategory ? getTopCategoryLabel(topCategory as any) : "All"}
            open={openMenu === "gender"}
            onToggle={() => setOpenMenu(openMenu === "gender" ? null : "gender")}
          >
            <MenuOption
              active={!topCategory}
              onClick={() => {
                setTopCategory("");
                setOpenMenu(null);
              }}
            >
              All
            </MenuOption>
            {TOP_CATEGORY_OPTIONS.map((item) => (
              <MenuOption
                key={item}
                active={topCategory === item}
                onClick={() => {
                  setTopCategory(item);
                  setOpenMenu(null);
                }}
              >
                {getTopCategoryLabel(item)}
              </MenuOption>
            ))}
          </DropdownMenu>

          <DropdownMenu
            title="Type"
            value={effectiveProductType || "All"}
            open={openMenu === "type"}
            onToggle={() => setOpenMenu(openMenu === "type" ? null : "type")}
          >
            <MenuOption
              active={!effectiveProductType}
              onClick={() => {
                setProductType("");
                setOpenMenu(null);
              }}
            >
              All
            </MenuOption>
            {PRODUCT_TYPE_OPTIONS.map((item) => (
              <MenuOption
                key={item}
                active={effectiveProductType === item}
                onClick={() => {
                  setProductType(item);
                  setOpenMenu(null);
                }}
              >
                {item}
              </MenuOption>
            ))}
          </DropdownMenu>

          <DropdownMenu
            title="Category"
            value={effectiveSubCategory || "All"}
            open={openMenu === "category"}
            onToggle={() => setOpenMenu(openMenu === "category" ? null : "category")}
          >
            <MenuOption
              active={!effectiveSubCategory}
              onClick={() => {
                setSubCategory("");
                setOpenMenu(null);
              }}
            >
              All
            </MenuOption>
            {subCategoryOptions.map((item) => (
              <MenuOption
                key={item}
                active={effectiveSubCategory === item}
                onClick={() => {
                  setSubCategory(item);
                  setOpenMenu(null);
                }}
              >
                {item}
              </MenuOption>
            ))}
          </DropdownMenu>

          <DropdownMenu
            title="Size"
            value={effectiveSize || "All"}
            open={openMenu === "size"}
            onToggle={() => setOpenMenu(openMenu === "size" ? null : "size")}
          >
            <MenuOption
              active={!effectiveSize}
              onClick={() => {
                setSize("");
                setOpenMenu(null);
              }}
            >
              All
            </MenuOption>
            {sizeOptions.map((item) => (
              <MenuOption
                key={item}
                active={effectiveSize === item}
                onClick={() => {
                  setSize(item);
                  setOpenMenu(null);
                }}
              >
                {item}
              </MenuOption>
            ))}
          </DropdownMenu>

          {topCategory === "Kids" ? (
            <DropdownMenu
              title="Age Group"
              value={juniorGroup || "All"}
              open={openMenu === "group"}
              onToggle={() => setOpenMenu(openMenu === "group" ? null : "group")}
            >
              <MenuOption
                active={!juniorGroup}
                onClick={() => {
                  setJuniorGroup("");
                  setOpenMenu(null);
                }}
              >
                All
              </MenuOption>
              {JUNIOR_GROUP_OPTIONS.map((item) => (
                <MenuOption
                  key={item}
                  active={juniorGroup === item}
                  onClick={() => {
                    setJuniorGroup(item);
                    setOpenMenu(null);
                  }}
                >
                  {item}
                </MenuOption>
              ))}
            </DropdownMenu>
          ) : null}

          <DropdownMenu
            title="Sort"
            value={getMenuValueLabel(
              SORT_OPTIONS.map((item) => ({ value: item.value, label: item.label })),
              sortBy,
            )}
            open={openMenu === "sort"}
            onToggle={() => setOpenMenu(openMenu === "sort" ? null : "sort")}
          >
            {SORT_OPTIONS.map((item) => (
              <MenuOption
                key={item.value}
                active={sortBy === item.value}
                onClick={() => {
                  setSortBy(item.value);
                  setOpenMenu(null);
                }}
              >
                {item.label}
              </MenuOption>
            ))}
          </DropdownMenu>
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

function DropdownMenu({
  title,
  value,
  open,
  onToggle,
  children,
}: {
  title: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
        className={`flex items-center gap-2 border px-3 py-2 text-sm font-medium transition-colors ${
          open ? "border-black bg-black text-white" : "border-zinc-300 bg-white text-zinc-900 hover:border-black"
        }`}
      >
        <span>{title}</span>
        <span className="text-xs text-zinc-500">{value}</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-48 border border-zinc-300 bg-white shadow-lg">
          <div className="max-h-64 overflow-y-auto">{children}</div>
        </div>
      ) : null}
    </div>
  );
}

function MenuOption({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-3 py-2 text-left text-sm transition-colors ${
        active ? "bg-black text-white font-medium" : "bg-white text-zinc-900 hover:bg-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}
