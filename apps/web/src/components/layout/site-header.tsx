"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  MEN_CATEGORY_CARD_IMAGES,
  WOMEN_CATEGORY_CARD_IMAGES,
  FALLBACK_CATEGORY_IMAGE,
  MEN_PRESET_CATEGORIES,
  WOMEN_PRESET_CATEGORIES,
  JUNIOR_GROUPS,
  JUNIOR_GROUP_IMAGES,
  JUNIOR_SUBCATEGORIES,
  JUNIORS_DEFAULT_SUBCATEGORIES,
} from "@/lib/category-images";
import { fetchCurrentUser } from "@/lib/auth-client";
import {
  addWishlistProduct,
  getProductSearchSuggestions,
  getProducts,
  getUserCartItems,
  getUserNotifications,
  getUserNotificationsUnreadCount,
  getBrandDashboardNotifications,
  getBrandDashboardNotificationsUnreadCount,
  markAllNotificationsAsRead,
  getWishlistProducts,
  syncUserCartItems,
} from "@/lib/api";
import { fallbackProducts } from "@/lib/mock-data";
import { ProductImage } from "@/components/ui/product-image";
import { buildSearchSuggestions, correctSearchQuery, filterProductsBySearchQuery } from "@/lib/search-fallback";
import { normalizeProduct, resolveTopCategoryFilter } from "@/lib/taxonomy";
import { buildCatalogFiltersFromSuggestion, inferCatalogFiltersFromQuery } from "@/lib/catalog-search";
import { getNotificationHref } from "@/lib/notification-routing";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import { maskOrderId } from "@/lib/notification-utils";
import type { NotificationItem, Product, SearchSuggestion } from "@/types/marketplace";

function getCartKey(item: { product: Product; selectedColor?: string; selectedSize?: string }) {
  return `${item.product.id}:${item.selectedSize || ""}:${item.selectedColor || ""}`;
}

const baseNavLinkClass = "relative whitespace-nowrap text-xs font-semibold uppercase tracking-[0.14em] decoration-1 underline-offset-8";

const dropdownNavLinkClass = "relative whitespace-nowrap text-xs font-semibold uppercase tracking-[0.14em] decoration-1 underline-offset-8 hover:underline";

const dropdownMenuShellClass =
  "fixed left-1/2 top-[73px] z-50 w-[calc(100vw-2rem)] max-w-7xl -translate-x-1/2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl";

const dropdownCardLabelClass = "mt-3 inline-flex text-sm font-medium uppercase tracking-[0.08em] text-zinc-900 group-hover:underline";

type CatalogFilters = {
  q?: string;
  topCategory?: string;
  juniorCategory?: string;
  productType?: string;
  subCategory?: string;
  size?: string;
  correctedFrom?: string;
};

type CatalogCard = {
  label: string;
  filters: CatalogFilters;
};

const MEN_WOMEN_MENU_ITEMS: CatalogCard[] = [
  { label: "Shirts", filters: { q: "Shirts", productType: "Top" } },
  { label: "T-Shirts", filters: { q: "T-Shirts", productType: "Top", subCategory: "T-Shirts" } },
  { label: "Jackets", filters: { q: "Jackets", productType: "Top" } },
  { label: "Polo", filters: { q: "Polo Shirts", productType: "Top", subCategory: "Polo Shirts" } },
  { label: "Jeans", filters: { q: "Jeans", productType: "Bottom", subCategory: "Jeans" } },
  { label: "Sneakers", filters: { q: "Sneakers", productType: "Footwear", subCategory: "Sneakers" } },
  { label: "Boots", filters: { q: "Boots", productType: "Footwear", subCategory: "Boots" } },
  { label: "Bags", filters: { q: "Bags", productType: "Accessories", subCategory: "Bags" } },
  { label: "Belts", filters: { q: "Belts", productType: "Accessories", subCategory: "Belts" } },
  { label: "Jewelry", filters: { q: "Jewelry", productType: "Accessories", subCategory: "Jewelry" } },
];

const primaryNavItems = [
  { href: "/category/Men", label: "Men" },
  { href: "/category/Women", label: "Women" },
  { href: "/category/Juniors", label: "Juniors" },
  { href: "/catalog", label: "Catalog" },
  { href: "/offers", label: "Offers" },
  { href: "/brands", label: "Brands" },
];

const RECENT_SEARCHES_KEY = "broady:recent-searches";
const fallbackCatalogProducts = fallbackProducts.map(normalizeProduct);

const priceFormatter = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

const starterSearchSuggestions: SearchSuggestion[] = [
  {
    id: "starter:men-black-polo",
    label: "Men black polo shirt",
    query: "men black polo shirt",
    kind: "query",
    gender: "Men",
    topCategory: "Men",
    productType: "Top",
    subCategory: "Polo Shirts",
    color: "black",
  },
  {
    id: "starter:baggy-jeans",
    label: "Baggy jeans",
    query: "baggy jeans",
    kind: "query",
    productType: "Bottom",
    subCategory: "Jeans",
  },
  {
    id: "starter:girls-jeans",
    label: "Girls jeans",
    query: "girls jeans",
    kind: "query",
    gender: "Juniors",
    topCategory: "Junior Girls",
    juniorCategory: "Junior Girls",
    productType: "Bottom",
    subCategory: "Jeans",
  },
  {
    id: "starter:men-jeans",
    label: "Men jeans",
    query: "men jeans",
    kind: "query",
    gender: "Men",
    topCategory: "Men",
    productType: "Bottom",
    subCategory: "Jeans",
  },
  {
    id: "starter:junior-jeans",
    label: "Junior jeans",
    query: "junior jeans",
    kind: "query",
    gender: "Juniors",
    productType: "Bottom",
    subCategory: "Jeans",
  },
  {
    id: "starter:women-jackets",
    label: "Women jackets",
    query: "women jackets",
    kind: "query",
    gender: "Women",
    topCategory: "Women",
    productType: "Top",
    subCategory: "Jackets",
  },
  {
    id: "starter:sneakers",
    label: "Sneakers",
    query: "sneakers",
    kind: "query",
    productType: "Footwear",
    subCategory: "Sneakers",
  },
  {
    id: "starter:bags",
    label: "Bags",
    query: "bags",
    kind: "query",
    productType: "Accessories",
    subCategory: "Bags",
  },
];

function suggestionFromQuery(query: string, idPrefix: string): SearchSuggestion {
  const inferred = inferCatalogFiltersFromQuery(query);

  return {
    id: `${idPrefix}:${query.toLowerCase()}`,
    label: query,
    query,
    kind: "query",
    topCategory: inferred.topCategory as SearchSuggestion["topCategory"],
    juniorCategory: inferred.juniorCategory as SearchSuggestion["juniorCategory"],
    productType: inferred.productType as SearchSuggestion["productType"],
    subCategory: inferred.subCategory,
    size: inferred.size,
  };
}

function mergeSearchSuggestions(...groups: SearchSuggestion[][]) {
  const seen = new Set<string>();
  const merged: SearchSuggestion[] = [];

  for (const group of groups) {
    for (const suggestion of group) {
      const key = `${suggestion.kind}:${suggestion.query.toLowerCase()}:${suggestion.label.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(suggestion);
    }
  }

  return merged;
}

function loadRecentSearches() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveRecentSearches(searches: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches.slice(0, 5)));
  } catch {
    // Local search history is best effort.
  }
}

function normalizeSearchFilterValue(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function productMatchesTopCategoryContext(product: Product, topCategoryContext?: string) {
  if (!topCategoryContext) return true;

  const context = normalizeSearchFilterValue(topCategoryContext);
  const gender = normalizeSearchFilterValue(product.gender);
  const topCategory = normalizeSearchFilterValue(product.topCategory);
  const juniorsGroup = normalizeSearchFilterValue(product.juniorsGroup);

  if (context === "men" || context === "women") {
    return gender === context || topCategory === context;
  }

  return gender === "juniors" || topCategory === context || juniorsGroup === context;
}

function formatProductPrice(product: Product) {
  return priceFormatter.format(product.salePrice ?? product.pricePkr ?? product.actualPrice ?? 0);
}

function isLinkActive(pathname: string, href: string) {
  if (href === "/catalog") {
    return pathname === "/catalog" || pathname.startsWith("/product/");
  }
  if (href.startsWith("/category/")) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkClass(pathname: string, href: string) {
  const active = isLinkActive(pathname, href);
  return `${baseNavLinkClass} ${active ? "underline" : "hover:underline"}`;
}

function buildCatalogHref(filters: CatalogFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.topCategory) params.set("topCategory", filters.topCategory);
  if (filters.juniorCategory) params.set("juniorCategory", filters.juniorCategory);
  if (filters.productType) params.set("productType", filters.productType);
  if (filters.subCategory) params.set("subCategory", filters.subCategory);
  if (filters.size) params.set("size", filters.size);
  if (filters.correctedFrom) params.set("correctedFrom", filters.correctedFrom);

  const query = params.toString();
  return query ? `/catalog?${query}` : "/catalog";
}

function formatNotificationTimestamp(value?: string | null) {
  if (!value) return "N/A";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);
  const diffHours = Math.round(diffMs / 3_600_000);

  if (Math.abs(diffMinutes) < 1) return "just now";
  if (Math.abs(diffMinutes) < 60) return `${Math.abs(diffMinutes)} min${Math.abs(diffMinutes) === 1 ? "" : "s"} ago`;
  if (Math.abs(diffHours) < 24) return `${Math.abs(diffHours)} hour${Math.abs(diffHours) === 1 ? "" : "s"} ago`;

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(parsed);
}

function canAccessBrandArea(role?: string) {
  return role === "BRAND_ADMIN" || role === "BRAND_STAFF" || role === "BRAND";
}

function IconButton({
  children,
  label,
  href,
  onClick,
  badge,
}: {
  children: ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  badge?: number;
}) {
  const content = (
    <>
      <span className="sr-only">{label}</span>
      {children}
      {badge && badge > 0 ? (
        <span className="absolute -right-2 -top-2 min-w-5 border border-black bg-white px-1 text-center text-[10px] font-semibold leading-4">
          {badge}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        title={label}
        aria-label={label}
        className="relative flex h-10 w-10 cursor-pointer items-center justify-center border border-zinc-300 bg-white hover:border-black"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="relative flex h-10 w-10 cursor-pointer items-center justify-center border border-zinc-300 bg-white hover:border-black"
    >
      {content}
    </button>
  );
}

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [openMenu, setOpenMenu] = useState<"men" | "women" | "juniors" | null>(null);
  const cartCount = useCartStore((state) => state.items.length);
  const cartItems = useCartStore((state) => state.items);
  const setCartItems = useCartStore((state) => state.setItems);
  const wishlistCount = useWishlistStore((state) => state.items.length);
  const setWishlistItems = useWishlistStore((state) => state.setItems);
  const clearWishlist = useWishlistStore((state) => state.clear);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const setInitialized = useAuthStore((state) => state.setInitialized);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsCorrection, setSuggestionsCorrection] = useState<string | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [liveResults, setLiveResults] = useState<Product[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [sessionNewNotificationIds, setSessionNewNotificationIds] = useState<Set<string>>(new Set());
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const cartSyncEnabledRef = useRef(false);
  const dropdownCloseTimerRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const topCategoryContext = useMemo(() => {
    if (!pathname.startsWith("/category/")) {
      return undefined;
    }

    const categorySlug = decodeURIComponent(pathname.split("/")[2] || "");
    const resolvedCategory = resolveTopCategoryFilter(categorySlug);
    if (
      resolvedCategory === "Men" ||
      resolvedCategory === "Women" ||
      resolvedCategory === "Toddler Boys" ||
      resolvedCategory === "Toddler Girls" ||
      resolvedCategory === "Junior Boys" ||
      resolvedCategory === "Junior Girls"
    ) {
      return resolvedCategory;
    }

    return undefined;
  }, [pathname]);

  const starterSuggestions = useMemo(() => {
    const recentSuggestions = recentSearches.map((query) => suggestionFromQuery(query, "recent"));
    const scopedStarterSuggestions = starterSearchSuggestions.filter((suggestion) => {
      if (!topCategoryContext) return true;
      if (!suggestion.topCategory && !suggestion.gender) return true;
      return (
        normalizeSearchFilterValue(suggestion.topCategory) === normalizeSearchFilterValue(topCategoryContext) ||
        normalizeSearchFilterValue(suggestion.juniorCategory) === normalizeSearchFilterValue(topCategoryContext) ||
        (normalizeSearchFilterValue(topCategoryContext).startsWith("junior") && suggestion.gender === "Juniors") ||
        (normalizeSearchFilterValue(topCategoryContext).startsWith("toddler") && suggestion.gender === "Juniors")
      );
    });

    return mergeSearchSuggestions(recentSuggestions, scopedStarterSuggestions).slice(0, 8);
  }, [recentSearches, topCategoryContext]);

  const defaultPreviewProducts = useMemo(
    () =>
      fallbackCatalogProducts
        .filter((product) => productMatchesTopCategoryContext(product, topCategoryContext))
        .slice(0, 4),
    [topCategoryContext],
  );

  const hasQuery = useMemo(() => searchTerm.trim().length > 0, [searchTerm]);
  const visibleSearchSuggestions = hasQuery ? suggestions : starterSuggestions;
  const visiblePreviewProducts = hasQuery ? liveResults : defaultPreviewProducts;

  const rememberSearch = (query: string) => {
    const normalized = query.trim();
    if (normalized.length < 2) return;

    setRecentSearches((current) => {
      const next = [normalized, ...current.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 5);
      saveRecentSearches(next);
      return next;
    });
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (activeSuggestionIndex >= 0 && visibleSearchSuggestions[activeSuggestionIndex]) {
      applySuggestion(visibleSearchSuggestions[activeSuggestionIndex] as SearchSuggestion);
    } else {
      void navigateToCatalogFromQuery(searchTerm);
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!visibleSearchSuggestions.length) {
        setActiveSuggestionIndex(-1);
        return;
      }
      setActiveSuggestionIndex((prev) => Math.min(prev + 1, visibleSearchSuggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!visibleSearchSuggestions.length) {
        setActiveSuggestionIndex(-1);
        return;
      }
      setActiveSuggestionIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Enter") {
      handleSearchSubmit(event as any);
    } else if (event.key === "Escape") {
      closeSearch();
    }
  };

  const applySuggestion = (item: SearchSuggestion) => {
    rememberSearch(item.query);
    const baseFilters = buildCatalogFiltersFromSuggestion(item);
    const scopedTopCategory = baseFilters.topCategory || topCategoryContext;
    navigateToCatalog({
      q: baseFilters.q || item.query,
      topCategory: scopedTopCategory,
      juniorCategory: baseFilters.juniorCategory,
      productType: baseFilters.productType,
      subCategory: baseFilters.subCategory,
      size: baseFilters.size,
    });
    closeSearch();
  };

  const navigateToCatalogFromQuery = async (query: string) => {
    const normalizedQuery = query.trim();
    const localCorrection = correctSearchQuery(normalizedQuery);
    let targetQuery = localCorrection || normalizedQuery;
    let correctedFrom: string | undefined;
    if (localCorrection && localCorrection.toLowerCase() !== normalizedQuery.toLowerCase()) {
      correctedFrom = normalizedQuery;
    }

    try {
      const suggestionResult = await getProductSearchSuggestions(normalizedQuery, { topCategory: topCategoryContext });
      if (suggestionResult.correctedQuery) {
        targetQuery = suggestionResult.correctedQuery;
        correctedFrom = normalizedQuery;
      }
    } catch {
      // Ignore suggestion fetch errors and fall back to raw query.
    }

    rememberSearch(targetQuery);
    navigateToCatalog({
      q: targetQuery,
      topCategory: topCategoryContext,
      correctedFrom,
    });
    closeSearch();
  };

  const getLatestNotifications = useCallback(async () => {
    if (!user) return [];
    const isBrandUser = user.role === "BRAND" || user.role === "BRAND_ADMIN" || user.role === "BRAND_STAFF";
    return isBrandUser ? getBrandDashboardNotifications() : getUserNotifications();
  }, [user]);

  const getUnreadNotificationCount = useCallback(async () => {
    if (!user) return 0;
    const isBrandUser = user.role === "BRAND" || user.role === "BRAND_ADMIN" || user.role === "BRAND_STAFF";
    return isBrandUser ? getBrandDashboardNotificationsUnreadCount() : getUserNotificationsUnreadCount();
  }, [user]);

  const clearDropdownCloseTimer = () => {
    if (dropdownCloseTimerRef.current !== null) {
      window.clearTimeout(dropdownCloseTimerRef.current);
      dropdownCloseTimerRef.current = null;
    }
  };

  const closeDropdownMenu = () => {
    clearDropdownCloseTimer();
    setOpenMenu(null);
  };

  const scheduleDropdownClose = () => {
    clearDropdownCloseTimer();
    dropdownCloseTimerRef.current = window.setTimeout(() => {
      setOpenMenu(null);
      dropdownCloseTimerRef.current = null;
    }, 120);
  };

  const navigateToCatalog = (filters: CatalogFilters) => {
        startTransition(() => {
          router.push(buildCatalogHref(filters));
        });
        closeDropdownMenu();
      };

  useEffect(() => {
    let active = true;
    fetchCurrentUser().then(async (currentUser) => {
      if (!active) return;
      setUser(currentUser);
      if (currentUser) {
        try {
          const [products, remoteCartItems] = await Promise.all([getWishlistProducts(), getUserCartItems()]);
          if (active) {
            const localCartItems = useCartStore.getState().items;
            const mergedCartMap = new Map<string, { product: Product; quantity: number; selectedColor?: string; selectedSize?: string }>();
            for (const entry of remoteCartItems) {
              mergedCartMap.set(getCartKey(entry), { ...entry });
            }
            for (const entry of localCartItems) {
              const key = getCartKey(entry);
              const existing = mergedCartMap.get(key);
              if (existing) {
                mergedCartMap.set(key, { ...existing, quantity: existing.quantity + entry.quantity });
              } else {
                mergedCartMap.set(key, { ...entry });
              }
            }
            const mergedCart = Array.from(mergedCartMap.values());
            setCartItems(mergedCart);
            await syncUserCartItems(
              mergedCart.map((entry) => ({
                productId: entry.product.id,
                quantity: entry.quantity,
                selectedColor: entry.selectedColor,
                selectedSize: entry.selectedSize,
              })),
              { merge: false },
            );

            const localWishlistItems = useWishlistStore.getState().items;
            const seen = new Set(products.map((item) => item.slug));
            const merged = [...products];
            for (const localItem of localWishlistItems) {
              if (!seen.has(localItem.slug)) {
                merged.push(localItem);
                await addWishlistProduct(localItem.id).catch(() => undefined);
              }
            }
            setWishlistItems(merged);
            cartSyncEnabledRef.current = true;
          }
        } catch {
          if (active) {
            setCartItems(useCartStore.getState().items);
            setWishlistItems(useWishlistStore.getState().items);
            cartSyncEnabledRef.current = true;
          }
        }
      } else {
        cartSyncEnabledRef.current = false;
        clearWishlist();
      }
      setInitialized(true);
    });
    return () => {
      active = false;
    };
  }, [clearWishlist, setCartItems, setInitialized, setUser, setWishlistItems]);

  useEffect(() => {
    if (!user || !cartSyncEnabledRef.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void syncUserCartItems(
        cartItems.map((entry) => ({
          productId: entry.product.id,
          quantity: entry.quantity,
          selectedColor: entry.selectedColor,
          selectedSize: entry.selectedSize,
        })),
        { merge: false },
      );
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [cartItems, user]);

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }

    if (!user) {
      setNotifications([]);
      setNotificationError(null);
      return;
    }

    let active = true;
    setNotificationsLoading(true);
    setNotificationError(null);

    (async () => {
      try {
        const items = await getLatestNotifications();
        if (!active) return;

        // Track which items are newly unread before marking as read
        const newUnreadIds = new Set<string>(
          items
            .filter((item: NotificationItem) => !item.readAt)
            .map((item: NotificationItem) => item.id)
        );

        // Set NEW badge only for items that were unread before opening
        setSessionNewNotificationIds(newUnreadIds);

        try {
          await markAllNotificationsAsRead();
          const readAt = new Date().toISOString();
          // Update notifications with readAt timestamp for display
          const updatedNotifications = items.map((item: NotificationItem) => ({
            ...item,
            readAt: item.readAt || readAt,
          }));
          setNotifications(updatedNotifications);
          // Update unread count to 0 since we marked all as read
          setUnreadNotificationCount(0);
          // Clear NEW badges after marking as read (they'll be gone after a short delay)
          // Keep them visible for a moment for UX feedback
        } catch (readError) {
          console.error("Failed to mark all as read:", readError);
          setNotifications(items);
        }
      } catch (error) {
        if (!active) return;
        setNotificationError(error instanceof Error ? error.message : "Unable to load notifications.");
        setNotifications([]);
      } finally {
        if (active) {
          setNotificationsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [notificationsOpen, user, getLatestNotifications]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;
    const interval = window.setInterval(async () => {
      if (!active) return;
      try {
        const items = await getLatestNotifications();
        if (!active) return;
        setNotifications(items);
      } catch (error) {
        console.error("Failed to poll notifications:", error);
      }
    }, 30000); // Poll every 30 seconds

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user, getLatestNotifications]);

  useEffect(() => {
    if (!user) {
      setUnreadNotificationCount(0);
      return;
    }

    let active = true;

    // Initial fetch
    const fetchUnreadCount = async () => {
      try {
        const count = await getUnreadNotificationCount();
        if (active) {
          setUnreadNotificationCount(count);
        }
      } catch (error) {
        console.error("Failed to fetch unread notification count:", error);
      }
    };

    void fetchUnreadCount();

    // Poll every 30 seconds
    const interval = window.setInterval(fetchUnreadCount, 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user, getUnreadNotificationCount]);

  useEffect(() => {
    setRecentSearches(loadRecentSearches());
  }, []);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) {
      setSuggestions([]);
      setSuggestionsCorrection(null);
      setSuggestionsLoading(false);
      setActiveSuggestionIndex(-1);
      setLiveResults([]);
      return;
    }

    const rawQuery = searchTerm.trim();
    if (rawQuery.length < 2) {
      setSuggestions([]);
      setSuggestionsCorrection(null);
      setSuggestionsLoading(false);
      setActiveSuggestionIndex(-1);
      setLiveResults([]);
      return;
    }

    let active = true;
    setSuggestionsLoading(true);

    const timeout = setTimeout(async () => {
      const correctedQuery = correctSearchQuery(rawQuery) || rawQuery;
      const productParams: Record<string, string> = { q: correctedQuery };
      if (topCategoryContext) {
        productParams.topCategory = topCategoryContext;
      }

      try {
        const [suggestionResult, productResult] = await Promise.all([
          getProductSearchSuggestions(rawQuery, { topCategory: topCategoryContext }),
          getProducts(productParams),
        ]);

        if (!active) return;
        const fallbackSuggestions = buildSearchSuggestions(
          fallbackCatalogProducts,
          suggestionResult.correctedQuery || correctedQuery,
          8,
        );
        setSuggestions(mergeSearchSuggestions(suggestionResult.suggestions, fallbackSuggestions).slice(0, 8));
        setSuggestionsCorrection(
          suggestionResult.correctedQuery ||
            (correctedQuery.toLowerCase() !== rawQuery.toLowerCase() ? correctedQuery : null),
        );
        const apiLiveResults = productResult.slice(0, 6);
        if (apiLiveResults.length) {
          setLiveResults(apiLiveResults);
        } else {
          const fallbackLive = filterProductsBySearchQuery(fallbackCatalogProducts, correctedQuery).slice(0, 6);
          setLiveResults(fallbackLive);
        }
        setActiveSuggestionIndex(-1);
      } catch {
        if (!active) return;
        const correctedQuery = correctSearchQuery(rawQuery) || rawQuery;
        setSuggestions(buildSearchSuggestions(fallbackCatalogProducts, correctedQuery, 8));
        setSuggestionsCorrection(correctedQuery.toLowerCase() !== rawQuery.toLowerCase() ? correctedQuery : null);
        setLiveResults(filterProductsBySearchQuery(fallbackCatalogProducts, correctedQuery).slice(0, 6));
        setActiveSuggestionIndex(-1);
      } finally {
        if (active) {
          setSuggestionsLoading(false);
        }
      }
    }, 180);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [searchOpen, searchTerm, topCategoryContext]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchTerm("");
    setSuggestions([]);
    setSuggestionsCorrection(null);
    setLiveResults([]);
    setActiveSuggestionIndex(-1);
  };

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-300 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 lg:px-10">
        <Link href="/" className="flex items-center">
          <Image src="/BROADY_LOGO.png" alt="BROADY Logo" width={150} height={50} priority />
        </Link>

        <nav className="hidden items-center gap-5 text-xs font-semibold uppercase tracking-[0.14em] lg:flex">
          {primaryNavItems.map((item) => {
            if (item.label === "Men") {
              return (
                <div
                  key={item.href}
                  onMouseEnter={() => {
                    clearDropdownCloseTimer();
                    setOpenMenu("men");
                  }}
                  onMouseLeave={scheduleDropdownClose}
                  className="relative"
                >
                  <Link
                    href={item.href}
                    onClick={closeDropdownMenu}
                    className={`${dropdownNavLinkClass} inline-flex items-center py-1`}
                  >
                    {item.label}
                  </Link>
                  {openMenu === "men" ? (
                    <div
                      onMouseEnter={clearDropdownCloseTimer}
                      onMouseLeave={scheduleDropdownClose}
                      className={dropdownMenuShellClass}
                    >
                      <div className="mx-auto grid max-w-7xl grid-cols-4 gap-4 px-4 py-6 lg:px-10">
                        {MEN_PRESET_CATEGORIES.map((cat) => {
                          const menuItem = MEN_WOMEN_MENU_ITEMS.find((menu) => menu.label === cat);
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => navigateToCatalog({ topCategory: "Men", ...menuItem?.filters })}
                              className="group block w-full text-left"
                            >
                              <div className="relative aspect-[4/3] w-full overflow-hidden border border-zinc-200 bg-zinc-100">
                                <Image
                                  src={MEN_CATEGORY_CARD_IMAGES[cat] || FALLBACK_CATEGORY_IMAGE}
                                  alt={cat}
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 768px) 50vw, 20vw"
                                />
                              </div>
                              <div className={dropdownCardLabelClass}>{cat}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            }

            if (item.label === "Women") {
              return (
                <div
                  key={item.href}
                  onMouseEnter={() => {
                    clearDropdownCloseTimer();
                    setOpenMenu("women");
                  }}
                  onMouseLeave={scheduleDropdownClose}
                  className="relative"
                >
                  <Link
                    href={item.href}
                    onClick={closeDropdownMenu}
                    className={`${dropdownNavLinkClass} inline-flex items-center py-1`}
                  >
                    {item.label}
                  </Link>
                  {openMenu === "women" ? (
                    <div
                      onMouseEnter={clearDropdownCloseTimer}
                      onMouseLeave={scheduleDropdownClose}
                      className={dropdownMenuShellClass}
                    >
                      <div className="mx-auto grid max-w-7xl grid-cols-4 gap-4 px-4 py-6 lg:px-10">
                        {WOMEN_PRESET_CATEGORIES.map((cat) => {
                          const menuItem = MEN_WOMEN_MENU_ITEMS.find((menu) => menu.label === cat);
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => navigateToCatalog({ topCategory: "Women", ...menuItem?.filters })}
                              className="group block w-full text-left"
                            >
                              <div className="relative aspect-[4/3] w-full overflow-hidden border border-zinc-200 bg-zinc-100">
                                <Image
                                  src={WOMEN_CATEGORY_CARD_IMAGES[cat] || FALLBACK_CATEGORY_IMAGE}
                                  alt={cat}
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 768px) 50vw, 20vw"
                                />
                              </div>
                              <div className={dropdownCardLabelClass}>{cat}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            }
            if (item.label === "Juniors") {
              return (
                <div
                  key={item.href}
                  onMouseEnter={() => {
                    clearDropdownCloseTimer();
                    setOpenMenu("juniors");
                  }}
                  onMouseLeave={scheduleDropdownClose}
                  className="relative"
                >
                  <Link
                    href={item.href}
                    onClick={closeDropdownMenu}
                    className={`${dropdownNavLinkClass} inline-flex items-center py-1`}
                  >
                    {item.label}
                  </Link>
                  {openMenu === "juniors" ? (
                    <div
                      onMouseEnter={clearDropdownCloseTimer}
                      onMouseLeave={scheduleDropdownClose}
                      className={dropdownMenuShellClass}
                    >
                      <div className="mx-auto grid max-w-7xl grid-cols-4 gap-4 px-4 py-6 lg:px-10">
                        {JUNIOR_GROUPS.map((group) => {
                          const groupSlug = group.toLowerCase().replace(/\s+/g, "-");
                          return (
                            <div key={group} className="space-y-3">
                              <Link href={`/category/${groupSlug}`} onClick={closeDropdownMenu} className="group block">
                                <div className="relative aspect-[4/3] w-full overflow-hidden border border-zinc-200 bg-zinc-100">
                                  <Image
                                    src={JUNIOR_GROUP_IMAGES[group]}
                                    alt={group}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 768px) 50vw, 20vw"
                                  />
                                </div>
                                <div className="mt-3 text-lg font-semibold uppercase tracking-[0.08em] text-zinc-900 group-hover:underline">
                                  {group}
                                </div>
                              </Link>
                              <ul className="space-y-2">
                                {(JUNIOR_SUBCATEGORIES[group] || JUNIORS_DEFAULT_SUBCATEGORIES).map((sub) => (
                                  <li key={sub}>
                                    <button
                                      type="button"
                                      onClick={() => navigateToCatalog({ topCategory: group, subCategory: sub })}
                                      className="text-sm uppercase tracking-[0.08em] text-zinc-700 hover:underline"
                                    >
                                      {sub}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            }

            return (
              <Link key={item.href} href={item.href} className={navLinkClass(pathname, item.href)}>
                {item.label}
              </Link>
            );
          })}
          {canAccessBrandArea(user?.role) ? <Link href="/brand/dashboard" className={navLinkClass(pathname, "/brand/dashboard")}>Brand Dashboard</Link> : null}
          {user?.role === "SUPER_ADMIN" || user?.role === "ADMIN" ? <Link href="/admin" className={navLinkClass(pathname, "/admin")}>Admin</Link> : null}
        </nav>

        <div className="flex items-center gap-2">
          <IconButton label="Search products" onClick={() => setSearchOpen(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16 L21 21" />
            </svg>
          </IconButton>

          <IconButton href="/wishlist" label="Wishlist" badge={hasHydrated ? wishlistCount : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 20s-7-4.7-7-10.2C5 7 6.8 5 9.2 5c1.2 0 2.3.5 2.8 1.4.5-.9 1.6-1.4 2.8-1.4C17.2 5 19 7 19 9.8 19 15.3 12 20 12 20z" />
            </svg>
          </IconButton>

          <IconButton href="/cart" label="Cart" badge={hasHydrated ? cartCount : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 5h2l2 10h9l2-7H7" />
              <circle cx="10" cy="19" r="1.2" />
              <circle cx="16" cy="19" r="1.2" />
            </svg>
          </IconButton>

          <IconButton label="Notifications" onClick={() => setNotificationsOpen(true)} badge={unreadNotificationCount}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 4a4 4 0 0 0-4 4v2.8c0 .8-.3 1.5-.8 2.1L6 14.2V16h12v-1.8l-1.2-1.3a3 3 0 0 1-.8-2.1V8a4 4 0 0 0-4-4z" />
              <path d="M10 18a2 2 0 0 0 4 0" />
            </svg>
          </IconButton>

          <IconButton href={user ? "/account" : "/login"} label={user ? "Profile" : "Login / Profile"}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="3.2" />
              <path d="M5 20c0-3.2 2.8-5.4 7-5.4s7 2.2 7 5.4" />
            </svg>
          </IconButton>

        </div>
      </div>

      <div className="border-t border-zinc-200 px-4 py-2 lg:hidden">
        <nav className="mx-auto flex max-w-7xl items-center gap-5 overflow-x-auto text-[11px] font-semibold uppercase tracking-[0.12em]">
          {primaryNavItems.map((item) => (
            <Link key={item.href} href={item.href} className={navLinkClass(pathname, item.href)}>
              {item.label}
            </Link>
          ))}
          {canAccessBrandArea(user?.role) ? <Link href="/brand/dashboard" className={navLinkClass(pathname, "/brand/dashboard")}>Brand Dashboard</Link> : null}
          {user?.role === "SUPER_ADMIN" || user?.role === "ADMIN" ? <Link href="/admin" className={navLinkClass(pathname, "/admin")}>Admin</Link> : null}
        </nav>
      </div>

      <div
        className={`fixed inset-0 z-[70] transition ${searchOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden={!searchOpen}
      >
        <div className="absolute inset-0 bg-black/50" onClick={closeSearch} />
        <div
          className={`absolute left-0 right-0 top-0 border-b border-zinc-300 bg-white p-4 transition-transform duration-300 ${searchOpen ? "pointer-events-auto translate-y-0" : "pointer-events-none -translate-y-full"}`}
        >
          <div className="mx-auto max-w-6xl space-y-4">
            <div className="flex items-center gap-3">
              <form onSubmit={handleSearchSubmit} className="relative flex-1">
                <input
                  ref={searchInputRef}
                  type="search"
                  placeholder="Search products..."
                  aria-label="Search products"
                  className="h-12 w-full border border-zinc-300 bg-zinc-100 px-4 pr-12 text-base outline-none transition focus:border-black focus:bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
                <button
                  type="submit"
                  title="Search"
                  aria-label="Search"
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-zinc-600 hover:text-black"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-zinc-500"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </button>
              </form>
              <button
                type="button"
                title="Close search"
                aria-label="Close search"
                onClick={closeSearch}
                className="flex h-12 w-12 shrink-0 items-center justify-center border border-zinc-300 bg-white text-zinc-700 hover:border-black hover:text-black"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12" />
                  <path d="M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="grid overflow-hidden border border-zinc-200 bg-white shadow-2xl lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <section className="border-b border-zinc-200 lg:border-b-0 lg:border-r">
                <div className="flex h-11 items-center justify-between border-b border-zinc-200 px-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    {hasQuery ? "Suggestions" : "Suggested searches"}
                  </p>
                  {suggestionsLoading && hasQuery ? (
                    <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-400">Searching</span>
                  ) : null}
                </div>

                <div className="max-h-[360px] overflow-auto">
                  {visibleSearchSuggestions.length ? (
                    visibleSearchSuggestions.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-zinc-100 px-4 py-3 text-left text-sm ${activeSuggestionIndex === index ? "bg-zinc-100" : "hover:bg-zinc-50"}`}
                        onMouseEnter={() => setActiveSuggestionIndex(index)}
                        onClick={() => applySuggestion(item)}
                      >
                        <span className="min-w-0 truncate font-medium uppercase tracking-[0.08em] text-zinc-900">{item.label}</span>
                        <span className="max-w-28 truncate text-right text-xs uppercase tracking-[0.12em] text-zinc-500">
                          {item.brand || item.subCategory || item.topCategory || item.juniorCategory || item.kind}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-4 py-5 text-sm text-zinc-600">No suggestions found.</p>
                  )}
                  {suggestionsCorrection && hasQuery ? (
                    <button
                      type="button"
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-zinc-200 px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-zinc-600 hover:bg-zinc-50"
                      onClick={() => navigateToCatalogFromQuery(suggestionsCorrection)}
                    >
                      <span className="truncate">Did you mean {suggestionsCorrection}</span>
                      <span>Search</span>
                    </button>
                  ) : null}
                </div>
              </section>

              <section>
                <div className="flex h-11 items-center justify-between border-b border-zinc-200 px-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    {hasQuery ? "Related products" : "Popular products"}
                  </p>
                  {visiblePreviewProducts.length ? (
                    <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-400">{visiblePreviewProducts.length}</span>
                  ) : null}
                </div>

                <div className="max-h-[360px] overflow-auto">
                  {visiblePreviewProducts.length ? (
                    visiblePreviewProducts.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="grid min-h-24 w-full grid-cols-[64px_minmax(0,1fr)] gap-3 border-b border-zinc-100 px-4 py-3 text-left text-sm hover:bg-zinc-50 sm:grid-cols-[72px_minmax(0,1fr)_auto]"
                        onClick={() => {
                          router.push(`/product/${item.slug}`);
                          closeSearch();
                        }}
                      >
                        <span className="relative h-16 w-16 overflow-hidden border border-zinc-200 bg-zinc-100 sm:h-[72px] sm:w-[72px]">
                          <ProductImage
                            src={item.imageUrl}
                            alt={item.name}
                            fill
                            sizes="72px"
                            className="object-cover"
                          />
                        </span>
                        <span className="min-w-0 self-center">
                          <span className="block truncate font-semibold uppercase tracking-[0.08em] text-zinc-900">{item.name}</span>
                          <span className="mt-1 block truncate text-xs uppercase tracking-[0.12em] text-zinc-500">
                            {item.brand?.name || item.topCategory} / {item.subCategory}
                          </span>
                          <span className="mt-2 block text-xs font-semibold uppercase tracking-[0.08em] text-zinc-900 sm:hidden">
                            {formatProductPrice(item)}
                          </span>
                        </span>
                        <span className="hidden self-center whitespace-nowrap text-xs font-semibold uppercase tracking-[0.08em] text-zinc-900 sm:block">
                          {formatProductPrice(item)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-4 py-5 text-sm text-zinc-600">No matching products found.</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-[75] transition ${notificationsOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden={!notificationsOpen}
      >
        <div className="absolute inset-0 bg-black/40" onClick={() => setNotificationsOpen(false)} />
        <div className={`absolute right-4 top-20 w-[min(94vw,420px)] border border-zinc-300 bg-white p-4 shadow-xl transition-transform duration-200 ${notificationsOpen ? "pointer-events-auto translate-y-0" : "pointer-events-none -translate-y-4"}`}>
          <div className="flex items-start justify-between gap-3 border-b border-zinc-200 pb-3">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Notifications</p>
              <p className="mt-1 text-sm text-zinc-700">Recent updates for your account.</p>
            </div>
            <button type="button" className="border border-zinc-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" onClick={() => setNotificationsOpen(false)}>
              Close
            </button>
          </div>

          <div className="mt-3 max-h-80 space-y-2 overflow-auto">
            {!user ? (
              <p className="text-sm text-zinc-700">Sign in to view your notifications.</p>
            ) : notificationsLoading ? (
              <p className="text-sm text-zinc-700">Loading notifications...</p>
            ) : notificationError ? (
              <p className="text-sm text-amber-700">{notificationError}</p>
            ) : notifications.length ? (
              notifications.map((item) => (
                <Link
                  key={item.id}
                  href={getNotificationHref(item, user?.role)}
                  onClick={() => setNotificationsOpen(false)}
                  className="block border border-zinc-200 p-3 text-sm hover:border-black hover:bg-zinc-50 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold uppercase tracking-[0.08em]">{item.title}</p>
                      <p className="mt-1 text-zinc-600">
                        {/* Replace order ID with masked version in message */}
                        {item.order?.id
                          ? item.message.replace(
                              new RegExp(`\\b${item.order.id}\\b`, 'g'),
                              maskOrderId(item.order.id)
                            )
                          : item.message}
                      </p>
                    </div>
                    {sessionNewNotificationIds.has(item.id) && (
                      <span className="whitespace-nowrap rounded bg-black px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                        New
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                    {formatNotificationTimestamp(item.createdAt)}
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-zinc-700">No notifications yet.</p>
            )}
          </div>

          <div className="mt-4 border-t border-zinc-200 pt-3">
            <Link
              href="/account/notifications"
              className="inline-flex h-10 w-full items-center justify-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white"
              onClick={() => setNotificationsOpen(false)}
            >
              View All Notifications
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
