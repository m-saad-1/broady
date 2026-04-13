"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductCard } from "@/components/ui/product-card";
import type { Product } from "@/types/marketplace";

type ProductCarouselRowProps = {
  products: Product[];
  label: string;
};

export function ProductCarouselRow({ products, label }: ProductCarouselRowProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const maxLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    setCanScrollLeft(track.scrollLeft > 8);
    setCanScrollRight(track.scrollLeft < maxLeft - 8);
  }, []);

  useEffect(() => {
    updateScrollState();
    const track = trackRef.current;
    if (!track) return;

    track.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      track.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [products.length, updateScrollState]);

  const scrollByDirection = useCallback((direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;

    const firstChild = track.firstElementChild as HTMLElement | null;
    const cardWidth = firstChild?.clientWidth ?? 280;
    const nextOffset = Math.max(280, Math.floor(cardWidth * 1.05));
    track.scrollBy({
      left: direction * nextOffset,
      behavior: "smooth",
    });
  }, []);

  const itemClassName = useMemo(
    () => "min-w-[78%] shrink-0 snap-start sm:min-w-[47%] lg:min-w-[31%] xl:min-w-[calc((100%-3.75rem)/4)]",
    [],
  );

  return (
    <div className="relative space-y-3">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          aria-label={`Scroll ${label} left`}
          onClick={() => scrollByDirection(-1)}
          disabled={!canScrollLeft}
          className="inline-flex h-9 w-9 items-center justify-center border border-zinc-300 bg-white text-zinc-700 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-35"
        >
          <span aria-hidden="true">&#8592;</span>
        </button>
        <button
          type="button"
          aria-label={`Scroll ${label} right`}
          onClick={() => scrollByDirection(1)}
          disabled={!canScrollRight}
          className="inline-flex h-9 w-9 items-center justify-center border border-zinc-300 bg-white text-zinc-700 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-35"
        >
          <span aria-hidden="true">&#8594;</span>
        </button>
      </div>

      <div ref={trackRef} className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-1">
        {products.map((product) => (
          <div key={product.id} className={itemClassName}>
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </div>
  );
}