"use client";

import { useRef } from "react";
import { ProductCard } from "@/components/ui/product-card";
import type { Product } from "@/types/marketplace";

type ProductCarouselRowProps = {
  products: Product[];
  label: string;
};

export function ProductCarouselRow({ products, label }: ProductCarouselRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visibleProducts = products.slice(0, 24);

  const scrollByCards = (direction: "next" | "prev") => {
    const node = scrollRef.current;
    if (!node) return;
    const amount = node.clientWidth;
    node.scrollBy({
      left: direction === "next" ? amount : -amount,
      behavior: "smooth",
    });
  };

  return (
    <section aria-label={label} className="relative overflow-x-clip">
      <button
        type="button"
        aria-label={`Scroll ${label} left`}
        onClick={() => scrollByCards("prev")}
        className="absolute left-0 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-zinc-300 bg-white/95 text-zinc-700 shadow-sm hover:border-black hover:text-black transition-colors"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={`Scroll ${label} right`}
        onClick={() => scrollByCards("next")}
        className="absolute right-0 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-zinc-300 bg-white/95 text-zinc-700 shadow-sm hover:border-black hover:text-black transition-colors"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
      <div
        ref={scrollRef}
        className="no-scrollbar grid snap-x snap-mandatory grid-flow-col auto-cols-[calc((100vw-7.5rem)/4)] gap-4 overflow-x-auto px-5 pb-1 lg:auto-cols-[calc((100%-7.5rem)/4)]"
      >
        {visibleProducts.map((product) => (
          <div key={product.id} className="snap-start">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}