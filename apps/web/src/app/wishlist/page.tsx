"use client";

import { ProductCard } from "@/components/ui/product-card";
import { useWishlistStore } from "@/stores/wishlist-store";

export default function WishlistPage() {
  const items = useWishlistStore((state) => state.items);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Saved Collection</p>
        <h1 className="font-heading text-5xl uppercase">Wishlist</h1>
      </header>

      {items.length === 0 ? (
        <p className="border border-zinc-300 p-6 text-sm uppercase tracking-[0.12em] text-zinc-600">No products saved yet.</p>
      ) : (
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </section>
      )}
    </main>
  );
}
