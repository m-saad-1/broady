"use client";

import { useEffect, useMemo, useState } from "react";
import { getForYouRecommendationFeed, type RecommendationMeta } from "@/lib/api";
import { blendRecommendedProducts, getRecommendationProductIds, shuffleProducts } from "@/lib/recommendation-mix";
import { useAuthStore } from "@/stores/auth-store";
import type { Product } from "@/types/marketplace";
import { ProductCarouselRow } from "./product-carousel-row";

type RecommendedProductCarouselRowProps = {
  products: Product[];
  label: string;
  topCategory?: string;
  subCategory?: string;
  source?: string;
  limit?: number;
};

const JUNIOR_TOP_CATEGORIES = new Set(["Junior Boys", "Toddler Boys", "Junior Girls", "Toddler Girls"]);

function matchesRecommendationScope(product: Product, topCategory?: string, subCategory?: string) {
  if (subCategory && product.subCategory !== subCategory) return false;
  if (!topCategory) return true;
  if (topCategory === "Juniors") return JUNIOR_TOP_CATEGORIES.has(product.topCategory);
  return product.topCategory === topCategory;
}

export function RecommendedProductCarouselRow({
  products,
  label,
  topCategory,
  subCategory,
  source,
  limit = 24,
}: RecommendedProductCarouselRowProps) {
  const user = useAuthStore((state) => state.user);
  const initialProducts = useMemo(() => products.slice(0, limit), [limit, products]);
  const [displayProducts, setDisplayProducts] = useState<Product[]>(initialProducts);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [recommendationMeta, setRecommendationMeta] = useState<RecommendationMeta | undefined>();

  useEffect(() => {
    let active = true;
    const shuffledProducts = shuffleProducts(products);
    const shuffleHandle = window.setTimeout(() => {
      if (!active) return;
      setDisplayProducts(shuffledProducts.slice(0, limit));
      setRecommendedProducts([]);
      setRecommendationMeta(undefined);
    }, 0);

    const recommendationTopCategory = topCategory === "Juniors" ? undefined : topCategory;

    getForYouRecommendationFeed({
      limit: Math.max(limit * 2, 32),
      topCategory: recommendationTopCategory,
      subCategory,
    })
      .then((feed) => {
        if (!active) return;

        const scopedRecommendations = feed.products.filter((product) =>
          matchesRecommendationScope(product, topCategory, subCategory),
        );
        const mixedProducts = blendRecommendedProducts({
          recommended: scopedRecommendations,
          products: shuffledProducts,
          limit,
          recommendedSlots: 2,
          organicSlots: 1,
        });

        setRecommendedProducts(scopedRecommendations);
        setRecommendationMeta(scopedRecommendations.length ? feed.meta : undefined);
        setDisplayProducts(mixedProducts.length ? mixedProducts : shuffledProducts.slice(0, limit));
      })
      .catch(() => {
        if (!active) return;
        setDisplayProducts(shuffledProducts.slice(0, limit));
      });

    return () => {
      active = false;
      window.clearTimeout(shuffleHandle);
    };
  }, [limit, products, subCategory, topCategory, user?.id]);

  return (
    <ProductCarouselRow
      products={displayProducts}
      label={label}
      recommendationMeta={recommendationMeta}
      recommendationProductIds={getRecommendationProductIds(recommendedProducts)}
      source={source || label}
    />
  );
}
