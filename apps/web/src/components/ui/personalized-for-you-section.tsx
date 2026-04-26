"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getUserOrders } from "@/lib/api";
import { ProductCarouselRow } from "@/components/ui/product-carousel-row";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import type { Product } from "@/types/marketplace";

type PersonalizedForYouSectionProps = {
  products: Product[];
};

export function PersonalizedForYouSection({ products }: PersonalizedForYouSectionProps) {
  const user = useAuthStore((state) => state.user);
  const cartItems = useCartStore((state) => state.items);
  const [orderedProducts, setOrderedProducts] = useState<Product[]>([]);
  const [ordersChecked, setOrdersChecked] = useState(false);

  useEffect(() => {
    let active = true;

    if (!user) {
      setOrderedProducts([]);
      setOrdersChecked(true);
      return () => {
        active = false;
      };
    }

    setOrdersChecked(false);
    getUserOrders()
      .then((orders) => {
        if (!active) return;
        const ordered = orders.flatMap((order) => order.items.map((item) => item.product));
        setOrderedProducts(ordered);
      })
      .catch(() => {
        if (active) {
          setOrderedProducts([]);
        }
      })
      .finally(() => {
        if (active) {
          setOrdersChecked(true);
        }
      });

    return () => {
      active = false;
    };
  }, [user]);

  const sourceProducts = useMemo(
    () => [...cartItems.map((item) => item.product), ...orderedProducts],
    [cartItems, orderedProducts],
  );

  const hasActivity = sourceProducts.length > 0;

  const recommended = useMemo(() => {
    if (!hasActivity) return [];

    const sourceIds = new Set(sourceProducts.map((item) => item.id));
    const topCategories = new Set(sourceProducts.map((item) => item.topCategory));
    const subCategories = new Set(sourceProducts.map((item) => item.subCategory));
    const productTypes = new Set(sourceProducts.map((item) => item.productType || "Top"));

    const related = products.filter((product) => {
      if (sourceIds.has(product.id)) return false;
      return (
        topCategories.has(product.topCategory) ||
        subCategories.has(product.subCategory) ||
        productTypes.has(product.productType || "Top")
      );
    });

    if (related.length >= 10) {
      return related.slice(0, 10);
    }

    const fallback = products.filter((product) => !sourceIds.has(product.id));
    return [...related, ...fallback].slice(0, 10);
  }, [hasActivity, products, sourceProducts]);

  if ((user && !ordersChecked) || !hasActivity || !recommended.length) {
    return null;
  }

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-4 border-b border-zinc-300 pb-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Tailored discovery</p>
          <h2 className="font-heading text-3xl uppercase tracking-[0.06em] md:text-4xl">For You</h2>
        </div>
        <Link
          href="/wishlist"
          className="relative text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600 transition-colors hover:text-black after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-black after:transition-transform after:duration-200 hover:after:scale-x-100"
        >
          Build Your Edit
        </Link>
      </div>
      <ProductCarouselRow products={recommended} label="For You" />
    </section>
  );
}