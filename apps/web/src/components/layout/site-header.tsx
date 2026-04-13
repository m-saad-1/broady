"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { fetchCurrentUser } from "@/lib/auth-client";
import { addWishlistProduct, getUserCartItems, getUserNotifications, getWishlistProducts, syncUserCartItems } from "@/lib/api";
import { fallbackProducts } from "@/lib/mock-data";
import { useMockFallback } from "@/lib/runtime-flags";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import type { NotificationItem, Product } from "@/types/marketplace";

function scoreProductMatch(product: Product, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const name = product.name.toLowerCase();
  const brand = product.brand?.name?.toLowerCase() || "";
  const subCategory = product.subCategory.toLowerCase();
  const topCategory = product.topCategory.toLowerCase();

  if (name === q) return 120;
  if (name.startsWith(q)) return 100;
  if (name.includes(q)) return 80;
  if (subCategory.startsWith(q)) return 65;
  if (subCategory.includes(q)) return 60;
  if (brand.startsWith(q)) return 55;
  if (brand.includes(q)) return 50;
  if (topCategory === q) return 40;

  return 0;
}

function getCartKey(item: { product: Product; selectedColor?: string; selectedSize?: string }) {
  return `${item.product.id}:${item.selectedSize || ""}:${item.selectedColor || ""}`;
}

const baseNavLinkClass =
  "relative whitespace-nowrap after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:bg-black after:transition-transform after:duration-200";

const primaryNavItems = [
  { href: "/category/Men", label: "Men" },
  { href: "/category/Women", label: "Women" },
  { href: "/category/Kids", label: "Kids" },
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
  const cartCount = useCartStore((state) => state.items.length);
  const cartItems = useCartStore((state) => state.items);
  const setCartItems = useCartStore((state) => state.setItems);
  const clearCart = useCartStore((state) => state.clearCart);
  const wishlistCount = useWishlistStore((state) => state.items.length);
  const setWishlistItems = useWishlistStore((state) => state.setItems);
  const clearWishlist = useWishlistStore((state) => state.clear);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const setInitialized = useAuthStore((state) => state.setInitialized);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [liveResults, setLiveResults] = useState<Product[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const cartSyncEnabledRef = useRef(false);

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
      setLiveResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      const q = searchTerm.trim();
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
      try {
        const response = await fetch(`${apiBase}/products?q=${encodeURIComponent(q)}`);
        if (!response.ok) throw new Error("search failed");
        const json = (await response.json()) as { data: Product[] };
        const baseProducts = useMockFallback
          ? (() => {
              const seen = new Set(json.data.map((item) => item.slug));
              const merged = [...json.data];
              for (const fallback of fallbackProducts) {
                if (!seen.has(fallback.slug)) {
                  merged.push(fallback);
                }
              }
              return merged;
            })()
          : json.data;
        const matched = baseProducts
          .map((product) => ({ product, score: scoreProductMatch(product, q) }))
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((item) => item.product)
          .slice(0, 8);
        setLiveResults(matched);
      } catch {
        const local = fallbackProducts
          .map((product) => ({ product, score: scoreProductMatch(product, q) }))
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((item) => item.product)
          .slice(0, 8);
        setLiveResults(local);
      }
    }, 180);

    return () => clearTimeout(timeout);
  }, [searchOpen, searchTerm]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchTerm("");
    setLiveResults([]);
  };

  const hasQuery = useMemo(() => searchTerm.trim().length > 0, [searchTerm]);
  const unreadNotificationCount = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications]);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-300 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 lg:px-10">
        <Link href="/" className="flex items-center">
          <Image src="/BROADY_LOGO.png" alt="BROADY Logo" width={150} height={50} priority />
        </Link>

        <nav className="hidden items-center gap-5 text-xs font-semibold uppercase tracking-[0.14em] lg:flex">
          {primaryNavItems.map((item) => (
            <Link key={item.href} href={item.href} className={navLinkClass(pathname, item.href)}>
              {item.label}
            </Link>
          ))}
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

          <IconButton href="/wishlist" label="Wishlist" badge={wishlistCount}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 20s-7-4.7-7-10.2C5 7 6.8 5 9.2 5c1.2 0 2.3.5 2.8 1.4.5-.9 1.6-1.4 2.8-1.4C17.2 5 19 7 19 9.8 19 15.3 12 20 12 20z" />
            </svg>
          </IconButton>

          <IconButton href="/cart" label="Cart" badge={cartCount}>
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
        className={`pointer-events-none fixed inset-0 z-[70] transition ${searchOpen ? "opacity-100" : "opacity-0"}`}
        aria-hidden={!searchOpen}
      >
        <div className="absolute inset-0 bg-black/50" onClick={closeSearch} />
        <div
          className={`pointer-events-auto absolute left-0 right-0 top-0 border-b border-zinc-300 bg-white p-4 transition-transform duration-300 ${searchOpen ? "translate-y-0" : "-translate-y-full"}`}
        >
          <div className="mx-auto max-w-5xl space-y-3">
            <div className="flex items-center gap-2">
              <input
                autoFocus={searchOpen}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && hasQuery) {
                    router.push(`/catalog?q=${encodeURIComponent(searchTerm.trim())}`);
                    closeSearch();
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
                  router.push(`/catalog?q=${encodeURIComponent(searchTerm.trim())}`);
                  closeSearch();
                }}
              >
                Search
              </button>
              <button type="button" className="h-12 border border-zinc-300 px-4 text-xs uppercase tracking-[0.12em]" onClick={closeSearch}>
                Close
              </button>
            </div>

            {hasQuery ? (
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
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={`pointer-events-none fixed inset-0 z-[75] transition ${notificationsOpen ? "opacity-100" : "opacity-0"}`}
        aria-hidden={!notificationsOpen}
      >
        <div className="absolute inset-0 bg-black/40" onClick={() => setNotificationsOpen(false)} />
        <div className={`pointer-events-auto absolute right-4 top-20 w-[min(94vw,420px)] border border-zinc-300 bg-white p-4 shadow-xl transition-transform duration-200 ${notificationsOpen ? "translate-y-0" : "-translate-y-4"}`}>
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
