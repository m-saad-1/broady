"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getForYouRecommendationFeed, type RecommendationMeta } from "@/lib/api";
import { getRecommendationProductIds } from "@/lib/recommendation-mix";
import { ProductCarouselRow } from "@/components/ui/product-carousel-row";
import { useAuthStore } from "@/stores/auth-store";
import type { Product } from "@/types/marketplace";

type PersonalizedForYouSectionProps = {
  products: Product[];
};

export function PersonalizedForYouSection({ products }: PersonalizedForYouSectionProps) {
  const user = useAuthStore((state) => state.user);
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [meta, setMeta] = useState<RecommendationMeta | undefined>();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    getForYouRecommendationFeed({ limit: 16 })
      .then((feed) => {
        if (!active) return;
        setRecommended(feed.products);
        setMeta(feed.meta);
      })
      .catch(() => {
        if (!active) return;
        setRecommended([]);
        setMeta(undefined);
      })
      .finally(() => {
        if (active) {
          setLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const displayProducts = useMemo(() => {
    if (recommended.length) return recommended;
    if (!loaded) return [];
    return products.slice(0, 16);
  }, [loaded, products, recommended]);

  if (!displayProducts.length) {
    return null;
  }

  return (
    <section className="min-w-0 space-y-5 overflow-x-hidden">
      <div className="flex items-end justify-between gap-4 border-b border-zinc-300 pb-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            {meta?.reason === "global-cold-start" ? "Trending starter picks" : "Tailored discovery"}
          </p>
          <h2 className="font-heading text-3xl uppercase tracking-[0.06em] md:text-4xl">For You</h2>
        </div>
        <Link
          href="/catalog"
          className="relative text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600 transition-colors hover:text-black after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-black after:transition-transform after:duration-200 hover:after:scale-x-100"
        >
          Tune Your Feed
        </Link>
      </div>
      <ProductCarouselRow
        products={displayProducts}
        label="For You"
        recommendationMeta={meta}
        recommendationProductIds={getRecommendationProductIds(recommended)}
        source="For You"
      />
    </section>
  );
}
