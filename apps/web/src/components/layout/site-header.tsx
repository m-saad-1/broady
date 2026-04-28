"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  MEN_CATEGORY_CARD_IMAGES,
  WOMEN_CATEGORY_CARD_IMAGES,
  FALLBACK_CATEGORY_IMAGE,
  MEN_PRESET_CATEGORIES,
  WOMEN_PRESET_CATEGORIES,
  JUNIOR_GROUPS,
  JUNIOR_SUBCATEGORIES,
} from "@/lib/category-images";
import { fetchCurrentUser } from "@/lib/auth-client";
import {
  addWishlistProduct,
  getProductSearchSuggestions,
  getProducts,
  getUserCartItems,
  getUserNotifications,
  getWishlistProducts,
  syncUserCartItems,
} from "@/lib/api";
import { fallbackProducts } from "@/lib/mock-data";
import { filterProductsBySubCategoryContains, isEligibleSearchQuery } from "@/lib/search-fallback";
import { inferProductType, normalizeProduct, resolveTopCategoryFilter } from "@/lib/taxonomy";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import type { NotificationItem, Product, SearchSuggestion } from "@/types/marketplace";

function getCartKey(item: { product: Product; selectedColor?: string; selectedSize?: string }) {
  return `${item.product.id}:${item.selectedSize || ""}:${item.selectedColor || ""}`;
}

const baseNavLinkClass =
  "relative whitespace-nowrap after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:bg-black after:transition-transform after:duration-200";

const dropdownNavLinkClass = "relative whitespace-nowrap text-xs font-semibold uppercase tracking-[0.14em]";

type CatalogFilters = {
  q?: string;
  topCategory?: string;
  productType?: string;
  subCategory?: string;
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
  { label: "Accessories", filters: { q: "Accessories", productType: "Accessories", subCategory: "Accessories" } },
];

const JUNIORS_MENU_ITEMS: CatalogCard[] = [
  { label: "Hoodies", filters: { q: "Hoodies", productType: "Top", subCategory: "Hoodies" } },
  { label: "Polo Shirts", filters: { q: "Polo Shirts", productType: "Top", subCategory: "Polo Shirts" } },
  { label: "Joggers", filters: { q: "Joggers", productType: "Bottom", subCategory: "Joggers" } },
  { label: "Slip Ons", filters: { q: "Slip Ons", productType: "Footwear", subCategory: "Slip Ons" } },
  { label: "Caps", filters: { q: "Caps", productType: "Accessories", subCategory: "Caps" } },
];

const primaryNavItems = [
  { href: "/category/Men", label: "Men" },
  { href: "/category/Women", label: "Women" },
  { href: "/category/Juniors", label: "Juniors" },
  { href: "/catalog", label: "Catalog" },
  { href: "/offers", label: "Offers" },
  { href: "/brands", label: "Brands" },
];

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
  return `${baseNavLinkClass} ${active ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100"}`;
}

function buildCatalogHref(filters: CatalogFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.topCategory) params.set("topCategory", filters.topCategory);
  if (filters.productType) params.set("productType", filters.productType);
  if (filters.subCategory) params.set("subCategory", filters.subCategory);

  const query = params.toString();
  return query ? `/catalog?${query}` : "/catalog";
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
  const [isPending, startTransition] = useTransition();
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const cartSyncEnabledRef = useRef(false);
  const dropdownCloseTimerRef = useRef<number | null>(null);

  const topCategoryContext = useMemo(() => {
    if (!pathname.startsWith("/category/")) {
      return undefined;
    }

    const categorySlug = decodeURIComponent(pathname.split("/")[2] || "");
    const resolvedCategory = resolveTopCategoryFilter(categorySlug);
    if (resolvedCategory === "Men" || resolvedCategory === "Women" || resolvedCategory === "Kids") {
      return resolvedCategory;
    }

    return undefined;
  }, [pathname]);

  const runCatalogSearch = (query: string, topCategory?: string) => {
    const q = query.trim();
    if (!q) {
      return;
    }

    const params = new URLSearchParams({ q });
    if (topCategory) {
      params.set("topCategory", topCategory);
    }

      startTransition(() => {
        router.push(`/catalog?${params.toString()}`);
      });
    setSearchOpen(false);
    setSearchTerm("");
    setSuggestions([]);
    setSuggestionsCorrection(null);
    setLiveResults([]);
    setActiveSuggestionIndex(-1);
  };

  const applySuggestion = (item: SearchSuggestion) => {
    const scopedTopCategory = item.topCategory || topCategoryContext;
    runCatalogSearch(item.query, scopedTopCategory);
  };

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
    getUserNotifications()
      .then((items) => {
        if (!active) return;
        setNotifications(items);
      })
      .catch((error) => {
        if (!active) return;
        setNotificationError(error instanceof Error ? error.message : "Unable to load notifications.");
      })
      .finally(() => {
        if (active) {
          setNotificationsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [notificationsOpen, user]);

  useEffect(() => {
    if (!searchOpen || searchTerm.trim().length < 2) {
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
      const q = searchTerm.trim();
      const productParams: Record<string, string> = { q };
      if (topCategoryContext) {
        productParams.topCategory = topCategoryContext;
      }

      try {
        const [suggestionResult, productResult] = await Promise.all([
          getProductSearchSuggestions(q, { topCategory: topCategoryContext }),
          getProducts(productParams),
        ]);

        if (!active) return;
        setSuggestions(suggestionResult.suggestions.slice(0, 8));
        setSuggestionsCorrection(suggestionResult.correctedQuery || null);
        const apiLiveResults = productResult.slice(0, 6);
        if (apiLiveResults.length) {
          setLiveResults(apiLiveResults);
        } else if (isEligibleSearchQuery(q)) {
          const fallbackLive = filterProductsBySubCategoryContains(
            fallbackProducts.map(normalizeProduct),
            q,
          ).slice(0, 6);
          setLiveResults(fallbackLive);
        } else {
          setLiveResults([]);
        }
        setActiveSuggestionIndex(-1);
      } catch {
        if (!active) return;
        setSuggestions([]);
        setSuggestionsCorrection(null);
        setLiveResults([]);
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

  const hasQuery = useMemo(() => searchTerm.trim().length > 0, [searchTerm]);
  const unreadNotificationCount = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications]);

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
                  <button
                    type="button"
                    onClick={() => setOpenMenu(openMenu === "men" ? null : "men")}
                    className={`${dropdownNavLinkClass} inline-flex cursor-pointer items-center py-1`}
                    aria-haspopup="true"
                    aria-expanded={openMenu === "men"}
                  >
                    {item.label}
                  </button>
                  {openMenu === "men" ? (
                    <div
                      onMouseEnter={clearDropdownCloseTimer}
                      onMouseLeave={scheduleDropdownClose}
                      className="absolute left-1/2 top-full z-50 w-screen -translate-x-1/2 rounded-b border border-zinc-200 bg-white shadow-lg"
                    >
                      <div className="mx-auto grid max-w-7xl grid-cols-4 gap-4 px-4 py-6 lg:px-10">
                        {MEN_PRESET_CATEGORIES.map((cat) => {
                          const menuItem = MEN_WOMEN_MENU_ITEMS.find((item) => item.label === cat);
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => navigateToCatalog({ topCategory: "Men", ...menuItem?.filters })}
                              className="block w-full text-left"
                            >
                              <div className="relative h-28 w-full overflow-hidden rounded bg-zinc-100">
                                <Image src={MEN_CATEGORY_CARD_IMAGES[cat] || FALLBACK_CATEGORY_IMAGE} alt={cat} fill className="object-cover" sizes="(max-width: 768px) 100vw, 25vw" />
                              </div>
                              <div className="mt-2 text-sm font-medium tracking-[0.08em] text-zinc-900">{cat}</div>
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
                  <button
                    type="button"
                    onClick={() => setOpenMenu(openMenu === "women" ? null : "women")}
                    className={`${dropdownNavLinkClass} inline-flex cursor-pointer items-center py-1`}
                    aria-haspopup="true"
                    aria-expanded={openMenu === "women"}
                  >
                    {item.label}
                  </button>
                  {openMenu === "women" ? (
                    <div
                      onMouseEnter={clearDropdownCloseTimer}
                      onMouseLeave={scheduleDropdownClose}
                      className="absolute left-1/2 top-full z-50 w-screen -translate-x-1/2 rounded-b border border-zinc-200 bg-white shadow-lg"
                    >
                      <div className="mx-auto grid max-w-7xl grid-cols-4 gap-4 px-4 py-6 lg:px-10">
                        {WOMEN_PRESET_CATEGORIES.map((cat) => {
                          const menuItem = MEN_WOMEN_MENU_ITEMS.find((item) => item.label === cat);
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => navigateToCatalog({ topCategory: "Women", ...menuItem?.filters })}
                              className="block w-full text-left"
                            >
                              <div className="relative h-28 w-full overflow-hidden rounded bg-zinc-100">
                                <Image src={WOMEN_CATEGORY_CARD_IMAGES[cat] || FALLBACK_CATEGORY_IMAGE} alt={cat} fill className="object-cover" sizes="(max-width: 768px) 100vw, 25vw" />
                              </div>
                              <div className="mt-2 text-sm font-medium tracking-[0.08em] text-zinc-900">{cat}</div>
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
                  <button
                    type="button"
                    onClick={() => setOpenMenu(openMenu === "juniors" ? null : "juniors")}
                    className={`${dropdownNavLinkClass} inline-flex cursor-pointer items-center py-1`}
                    aria-haspopup="true"
                    aria-expanded={openMenu === "juniors"}
                  >
                    {item.label}
                  </button>
                  {openMenu === "juniors" ? (
                    <div
                      onMouseEnter={clearDropdownCloseTimer}
                      onMouseLeave={scheduleDropdownClose}
                      className="absolute left-1/2 top-full z-50 w-screen -translate-x-1/2 rounded-b border border-zinc-200 bg-white shadow-lg"
                    >
                      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-10">
                        <div className="grid grid-cols-2 gap-4 mb-6 border-b border-zinc-200 pb-6">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600 mb-3">By Category</p>
                            <div className="grid grid-cols-2 gap-4">
                              {JUNIORS_MENU_ITEMS.map((cat) => (
                                <button
                                  key={cat.label}
                                  type="button"
                                  onClick={() => navigateToCatalog({ topCategory: "Kids", ...cat.filters })}
                                  className="block w-full text-left"
                                >
                                  <div className="relative h-24 w-full overflow-hidden rounded bg-zinc-100">
                                    <Image src={FALLBACK_CATEGORY_IMAGE} alt={cat.label} fill className="object-cover" sizes="(max-width: 768px) 100vw, 25vw" />
                                  </div>
                                  <div className="mt-2 text-sm font-medium tracking-[0.08em] text-zinc-900">{cat.label}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600 mb-3">By Group</p>
                            <ul className="space-y-2">
                              {JUNIOR_GROUPS.map((group) => (
                                <li key={group}>
                                  <button
                                    type="button"
                                    onClick={() => navigateToCatalog({ topCategory: "Kids", q: group, subCategory: group })}
                                    className="block w-full rounded px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 hover:text-black border border-zinc-200"
                                  >
                                    {group}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
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
          <div className="mx-auto max-w-5xl space-y-3">
            <div className="flex items-center gap-2">
              <input
                autoFocus={searchOpen}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (!hasQuery) {
                    return;
                  }

                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveSuggestionIndex((previous) => {
                      if (!suggestions.length) return -1;
                      const next = previous + 1;
                      return next >= suggestions.length ? 0 : next;
                    });
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveSuggestionIndex((previous) => {
                      if (!suggestions.length) return -1;
                      const next = previous - 1;
                      return next < 0 ? suggestions.length - 1 : next;
                    });
                  }

                  if (event.key === "Enter") {
                    event.preventDefault();
                    const activeSuggestion = activeSuggestionIndex >= 0 ? suggestions[activeSuggestionIndex] : undefined;
                    if (activeSuggestion) {
                      applySuggestion(activeSuggestion);
                      return;
                    }

                    runCatalogSearch(searchTerm, topCategoryContext);
                  }
                }}
                placeholder="Search products, subcategories, brands"
                className="h-12 flex-1 border border-zinc-300 px-4 text-sm uppercase tracking-[0.08em]"
              />
              <button
                type="button"
                className="h-12 border border-black bg-black px-5 text-xs font-semibold uppercase tracking-[0.12em] text-white"
                onClick={() => {
                  if (!hasQuery) return;
                  runCatalogSearch(searchTerm, topCategoryContext);
                }}
              >
                Search
              </button>
              <button type="button" className="h-12 border border-zinc-300 px-4 text-xs uppercase tracking-[0.12em]" onClick={closeSearch}>
                Close
              </button>
            </div>

            {hasQuery ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="max-h-72 overflow-auto border border-zinc-300">
                  {suggestionsLoading ? (
                    <p className="px-4 py-4 text-sm text-zinc-600">Searching suggestions...</p>
                  ) : suggestions.length ? (
                    suggestions.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`grid w-full grid-cols-[1fr_auto] gap-3 border-b border-zinc-200 px-4 py-3 text-left text-sm ${activeSuggestionIndex === index ? "bg-zinc-100" : "hover:bg-zinc-50"}`}
                        onMouseEnter={() => setActiveSuggestionIndex(index)}
                        onClick={() => applySuggestion(item)}
                      >
                        <span className="uppercase tracking-[0.08em]">{item.label}</span>
                        <span className="text-xs uppercase tracking-[0.12em] text-zinc-500">{item.topCategory || item.kind}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-4 py-4 text-sm text-zinc-600">No suggestions yet.</p>
                  )}
                  {suggestionsCorrection ? (
                    <button
                      type="button"
                      className="w-full border-t border-zinc-200 px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-zinc-600 hover:bg-zinc-50"
                      onClick={() => runCatalogSearch(suggestionsCorrection, topCategoryContext)}
                    >
                      Did you mean: {suggestionsCorrection}
                    </button>
                  ) : null}
                </div>

                <div className="max-h-72 overflow-auto border border-zinc-300">
                  {liveResults.length ? (
                    liveResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="grid w-full grid-cols-[1fr_auto] gap-3 border-b border-zinc-200 px-4 py-3 text-left text-sm hover:bg-zinc-50"
                        onClick={() => {
                          router.push(`/product/${item.slug}`);
                          closeSearch();
                        }}
                      >
                        <span className="uppercase tracking-[0.08em]">{item.name}</span>
                        <span className="text-xs uppercase tracking-[0.12em] text-zinc-500">{item.topCategory} / {item.subCategory}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-4 py-4 text-sm text-zinc-600">No matching products found.</p>
                  )}
                </div>
              </div>
            ) : null}
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
              notifications.slice(0, 5).map((item) => (
                <article key={item.id} className="border border-zinc-200 p-3 text-sm">
                  <p className="font-semibold uppercase tracking-[0.08em]">{item.title}</p>
                  <p className="mt-1 text-zinc-600">{item.message}</p>
                </article>
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
