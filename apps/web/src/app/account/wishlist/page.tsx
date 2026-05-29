"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getWishlistProducts, removeWishlistProduct } from "@/lib/api";
import { ProductImage } from "@/components/ui/product-image";
import { resolveMediaUrl } from "@/lib/media-url";
import { formatPkr } from "@/lib/utils";
import type { Product } from "@/types/marketplace";

export default function AccountWishlistPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getWishlistProducts().then((data) => {
      if (active) {
        setProducts(data);
        setLoading(false);
      }
    }).catch(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const onRemove = async (productId: string) => {
    try {
      await removeWishlistProduct(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
    } catch (error) {
      console.error("Failed to remove from wishlist", error);
    }
  };

  return (
    <main className="space-y-8">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Account</p>
        <h1 className="font-heading text-4xl uppercase">My Wishlist</h1>
        <p className="text-sm text-zinc-600">Items you've saved for later.</p>
      </header>

      {loading ? (
        <div className="py-20 text-center text-zinc-500 uppercase tracking-widest text-xs">Loading wishlist...</div>
      ) : products.length === 0 ? (
        <div className="border border-zinc-200 p-16 text-center">
          <p className="text-zinc-500 mb-6">Your wishlist is empty.</p>
          <Link href="/catalog" className="inline-flex h-11 items-center bg-black px-8 text-xs font-bold uppercase tracking-widest text-white">
            Discover Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <article key={product.id} className="group relative border border-zinc-200 p-3 hover:border-black transition-colors">
              <button 
                onClick={() => void onRemove(product.id)}
                className="absolute top-4 right-4 z-10 w-8 h-8 bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-red-600 hover:border-red-600 transition-colors"
              >
                ×
              </button>
              <Link href={`/product/${product.slug}`} className="block aspect-[3/4] relative overflow-hidden bg-zinc-100 mb-4">
                <ProductImage
                  src={resolveMediaUrl(product.imageUrl)}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </Link>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{product.brand?.name}</p>
                <h3 className="text-sm font-medium line-clamp-1 uppercase tracking-tight">{product.name}</h3>
                <p className="text-sm font-semibold">{formatPkr(product.pricePkr)}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
