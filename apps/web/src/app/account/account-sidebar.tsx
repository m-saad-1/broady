"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutUser } from "@/lib/auth-client";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";

const NAV_LINKS = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders & Tracking" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/payments", label: "Payment Methods" },
  { href: "/account/profile", label: "Profile Information" },
  { href: "/account/security", label: "Security" },
  { href: "/account/preferences", label: "Preferences" },
  { href: "/account/support", label: "Support" },
];

export function AccountSidebar({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const clearCart = useCartStore((state) => state.clearCart);
  const clearWishlist = useWishlistStore((state) => state.clear);

  const onLogout = async () => {
    await logoutUser();
    clearCart();
    clearWishlist();
    setUser(null);
    router.push("/");
    router.refresh();
  };

  return (
    <aside className={`flex flex-col gap-2 ${className}`}>
      {NAV_LINKS.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-2.5 text-xs tracking-wide transition-colors border-l-2 ${
              isActive
                ? "border-black bg-zinc-100 font-semibold text-black"
                : "border-transparent text-zinc-600 hover:bg-zinc-50 hover:text-black"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
      <div className="mt-auto pt-6 border-t border-zinc-200">
        <button
          type="button"
          onClick={() => void onLogout()}
          className="w-full h-11 flex items-center justify-center gap-2 bg-zinc-100 text-zinc-900 text-xs font-bold uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition-all border border-transparent hover:border-red-200 shadow-sm group"
        >
          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}
