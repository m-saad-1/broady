"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { fetchCurrentUser, logoutUser } from "@/lib/auth-client";
import { getWishlistProducts } from "@/lib/api";
import { fallbackProducts } from "@/lib/mock-data";
import { useMockFallback } from "@/lib/runtime-flags";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import type { Product } from "@/types/marketplace";

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

const navLinkClass =
  "relative after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-black after:transition-transform after:duration-200 hover:after:scale-x-100";

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
  const cartCount = useCartStore((state) => state.items.length);
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

  useEffect(() => {
    let active = true;
    fetchCurrentUser().then(async (currentUser) => {
      if (!active) return;
      setUser(currentUser);
      if (currentUser) {
        try {
          const products = await getWishlistProducts();
          if (active) {
            const localWishlistItems = useWishlistStore.getState().items;
            const seen = new Set(products.map((item) => item.slug));
            const merged = [...products];
            for (const localItem of localWishlistItems) {
              if (!seen.has(localItem.slug)) {
                merged.push(localItem);
              }
            }
            setWishlistItems(merged);
          }
        } catch {
          if (active) {
            setWishlistItems(useWishlistStore.getState().items);
          }
        }
      } else {
        clearWishlist();
      }
      setInitialized(true);
    });
    return () => {
      active = false;
    };
  }, [clearWishlist, setInitialized, setUser, setWishlistItems]);

  const onLogout = async () => {
    await logoutUser();
    clearCart();
    clearWishlist();
    setUser(null);
    router.push("/");
    router.refresh();
  };

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

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-300 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 lg:px-10">
        <Link href="/" className="flex items-center">
          <Image src="/BROADY_LOGO.png" alt="BROADY Logo" width={150} height={50} priority />
        </Link>

        <nav className="hidden items-center gap-5 text-xs font-semibold uppercase tracking-[0.14em] lg:flex">
          <Link href="/brands" className={navLinkClass}>Brands</Link>
          <Link href="/catalog" className={navLinkClass}>Catalog</Link>
          <Link href="/offers" className={navLinkClass}>Offers</Link>
          <Link href="/category/Men" className={navLinkClass}>Men</Link>
          <Link href="/category/Women" className={navLinkClass}>Women</Link>
          <Link href="/category/Kids" className={navLinkClass}>Kids</Link>
          {user?.role === "ADMIN" ? <Link href="/admin" className={navLinkClass}>Admin</Link> : null}
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

          <IconButton href={user ? "/account" : "/login"} label={user ? "Profile" : "Login / Profile"}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="3.2" />
              <path d="M5 20c0-3.2 2.8-5.4 7-5.4s7 2.2 7 5.4" />
            </svg>
          </IconButton>

          {user ? (
            <button
              type="button"
              onClick={onLogout}
              className="ml-1 hidden h-10 border border-black bg-black px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white sm:inline-flex sm:items-center"
            >
              Logout
            </button>
          ) : null}
        </div>
      </div>

      <div className="border-t border-zinc-200 px-4 py-2 lg:hidden">
        <nav className="mx-auto flex max-w-7xl items-center gap-5 overflow-x-auto text-[11px] font-semibold uppercase tracking-[0.12em]">
          <Link href="/brands" className={navLinkClass}>Brands</Link>
          <Link href="/catalog" className={navLinkClass}>Catalog</Link>
          <Link href="/offers" className={navLinkClass}>Offers</Link>
          <Link href="/category/Men" className={navLinkClass}>Men</Link>
          <Link href="/category/Women" className={navLinkClass}>Women</Link>
          <Link href="/category/Kids" className={navLinkClass}>Kids</Link>
          {user?.role === "ADMIN" ? <Link href="/admin" className={navLinkClass}>Admin</Link> : null}
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
    </header>
  );
}
