"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ProductCarouselRow } from "@/components/ui/product-carousel-row";
import { normalizeProduct } from "@/lib/taxonomy";
import type { Product } from "@/types/marketplace";

type Props = {
  products: Product[];
  categorySlug: string;
};

type ProductTypeFilter = "Top" | "Bottom" | "Footwear" | "Accessories";

const PRODUCT_TYPES: ProductTypeFilter[] = ["Top", "Bottom", "Footwear", "Accessories"];

const MEN_WOMEN_SECTIONS: Array<{ title: string; type?: ProductTypeFilter; helper?: string }> = [
  { title: "Top Items", type: "Top" },
  { title: "Bottom", type: "Bottom" },
  { title: "Footwear", type: "Footwear" },
  { title: "Accessories", type: "Accessories" },
  { title: "Trending", helper: "Best sellers from this category" },
  { title: "Shop by Style", helper: "Fresh looks grouped by signature subcategories" },
];

import {
  MEN_CATEGORY_CARD_IMAGES,
  WOMEN_CATEGORY_CARD_IMAGES,
  FALLBACK_CATEGORY_IMAGE,
  MEN_PRESET_CATEGORIES,
  WOMEN_PRESET_CATEGORIES,
  JUNIOR_GROUPS,
} from "@/lib/category-images";

function normalizeCategorySlug(value: string) {
  return decodeURIComponent(value).trim().toLowerCase();
}

function isMenSlug(slug: string) {
  return normalizeCategorySlug(slug) === "men";
}

function isWomenSlug(slug: string) {
  return normalizeCategorySlug(slug) === "women";
}

function isJuniorsSlug(slug: string) {
  const normalized = normalizeCategorySlug(slug);
  return normalized === "juniors" || normalized === "kids";
}

function slugToLabel(slug: string) {
  const normalized = normalizeCategorySlug(slug);
  if (normalized === "men") return "Men";
  if (normalized === "women") return "Women";
  if (normalized === "juniors" || normalized === "kids") return "Juniors";
  if (normalized === "junior-boys") return "Junior Boys";
  if (normalized === "toddler-boys") return "Toddler Boys";
  if (normalized === "junior-girls") return "Junior Girls";
  if (normalized === "toddler-girls") return "Toddler Girls";
  return "Category";
}

function mapTopCategory(slug: string) {
  if (isMenSlug(slug)) return "Men";
  if (isWomenSlug(slug)) return "Women";
  if (isJuniorsSlug(slug)) return "Kids";
  return "Kids";
}

function splitKidsProducts(products: Product[]) {
  const groups: Record<(typeof JUNIOR_GROUPS)[number], Product[]> = {
    "Junior Boys": [],
    "Toddler Boys": [],
    "Junior Girls": [],
    "Toddler Girls": [],
  };

  products.forEach((product, index) => {
    const text = `${product.name} ${product.subCategory}`.toLowerCase();
    const hasJuniorSize = product.sizes.some((size) => /^(8Y|10Y|12Y|14Y|16Y)$/.test(size.toUpperCase()));
    const age: "Junior" | "Toddler" = hasJuniorSize ? "Junior" : "Toddler";

    let gender: "Boys" | "Girls";
    if (text.includes("girl")) {
      gender = "Girls";
    } else if (text.includes("boy")) {
      gender = "Boys";
    } else {
      gender = index % 2 === 0 ? "Boys" : "Girls";
    }

    const group = `${age} ${gender}` as (typeof JUNIOR_GROUPS)[number];
    groups[group].push(product);
  });

  // Guarantee all group sections have products for a stable page structure.
  const fallbackCycle = [...products];
  JUNIOR_GROUPS.forEach((group, index) => {
    if (!groups[group].length && fallbackCycle.length) {
      groups[group].push(fallbackCycle[index % fallbackCycle.length]);
    }
  });

  return groups;
}

function ScrollCategoryCards({ items }: { items: Array<{ label: string; href: string; image?: string }> }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollByCards = (direction: "next" | "prev") => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollBy({
      left: direction === "next" ? node.clientWidth : -node.clientWidth,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative overflow-x-clip">
      <button
        type="button"
        aria-label="Scroll category cards left"
        onClick={() => scrollByCards("prev")}
        className="absolute left-0 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-zinc-300 bg-white/95 text-zinc-700 shadow-sm hover:border-black hover:text-black transition-colors"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Scroll category cards right"
        onClick={() => scrollByCards("next")}
        className="absolute right-0 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-zinc-300 bg-white/95 text-zinc-700 shadow-sm hover:border-black hover:text-black transition-colors"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
      <div ref={scrollRef} className="no-scrollbar grid grid-flow-col auto-cols-[calc((100vw-7.5rem)/5)] gap-4 overflow-x-auto px-5 pb-1 lg:auto-cols-[calc((100%-7.5rem)/5)]">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group relative flex min-h-64 items-end overflow-hidden border border-zinc-300 bg-zinc-50 p-4 transition hover:border-black"
          >
            {item.image ? (
              <Image
                src={item.image}
                alt={`${item.label} category`}
                fill
                sizes="(max-width: 1200px) 20vw, 15vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <span className="relative mt-auto block text-sm font-semibold uppercase tracking-[0.1em] text-white">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function BannerBlock({ title, subtitle, image }: { title: string; subtitle: string; image: string }) {
  return (
    <section className="relative overflow-hidden border border-zinc-300 p-8 md:p-12 min-h-80 md:min-h-96 flex items-center">
      <Image src={image} alt={`${title} banner`} fill sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />
      <div className="relative">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-200">Banner</p>
        <h2 className="mt-3 font-heading text-5xl uppercase text-white md:text-6xl">{title}</h2>
        <p className="mt-3 text-sm text-zinc-100">{subtitle}</p>
      </div>
    </section>
  );
}

function SectionBlock({ title, products, helper }: { title: string; products: Product[]; helper?: string }) {
  return (
    <section className="space-y-4">
      <div className="space-y-2 border-b border-zinc-300 pb-3">
        <h3 className="font-heading text-3xl uppercase tracking-[0.06em]">{title}</h3>
        {helper ? <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{helper}</p> : null}
      </div>
      <ProductCarouselRow products={products} label={title} />
    </section>
  );
}

function ProductTypesSwitch({ value, onChange }: { value: ProductTypeFilter; onChange: (next: ProductTypeFilter) => void }) {
  return (
    <section className="border border-zinc-300 p-3">
      <div className="flex flex-wrap gap-2">
        {PRODUCT_TYPES.map((type) => {
          const active = value === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onChange(type)}
              className={`border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                active ? "border-black bg-black text-white" : "border-zinc-300 bg-white text-zinc-700 hover:border-black"
              }`}
            >
              {type}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export function CategoryCollectionClient({ products, categorySlug }: Props) {
  const [selectedType, setSelectedType] = useState<ProductTypeFilter>("Top");

  const normalized = useMemo(() => products.map(normalizeProduct), [products]);
  const label = slugToLabel(categorySlug);
  const slug = normalizeCategorySlug(categorySlug);

  const categoryProducts = useMemo(() => {
    if (slug === "junior-boys" || slug === "toddler-boys" || slug === "junior-girls" || slug === "toddler-girls") {
      const kidsProducts = normalized.filter((item) => item.topCategory === "Kids");
      const split = splitKidsProducts(kidsProducts);
      const groupLabel = slugToLabel(slug) as (typeof JUNIOR_GROUPS)[number];
      return split[groupLabel] || [];
    }

    const topCategory = mapTopCategory(slug);
    return normalized.filter((item) => item.topCategory === topCategory);
  }, [normalized, slug]);

  const categoryCards = useMemo(() => {
    const unique = Array.from(new Set(categoryProducts.map((item) => item.subCategory))).sort();
    const categories = isMenSlug(slug)
      ? Array.from(new Set([...MEN_PRESET_CATEGORIES, ...unique]))
      : isWomenSlug(slug)
        ? Array.from(new Set([...WOMEN_PRESET_CATEGORIES, ...unique]))
        : unique;
    const imageMap = isMenSlug(slug)
      ? MEN_CATEGORY_CARD_IMAGES
      : isWomenSlug(slug)
        ? WOMEN_CATEGORY_CARD_IMAGES
        : {};

    return categories.map((subCategory) => ({
      label: subCategory,
      href: `/shop-by-category/${encodeURIComponent(subCategory)}?topCategory=${encodeURIComponent(mapTopCategory(slug))}`,
      image: imageMap[subCategory] || FALLBACK_CATEGORY_IMAGE,
    }));
  }, [categoryProducts, slug]);

  const sections = useMemo(() => {
    return MEN_WOMEN_SECTIONS.map((section) => {
      if (section.type) {
        return {
          ...section,
          products: categoryProducts.filter((item) => item.productType === section.type),
        };
      }
      if (section.title === "Trending") {
        return {
          ...section,
          products: [...categoryProducts].sort((a, b) => b.stock - a.stock).slice(0, 24),
        };
      }
      return {
        ...section,
        products: [...categoryProducts].sort((a, b) => a.subCategory.localeCompare(b.subCategory)).slice(0, 24),
      };
    });
  }, [categoryProducts]);

  const juniorsGroups = useMemo(() => {
    const kidsProducts = normalized.filter((item) => item.topCategory === "Kids");
    return splitKidsProducts(kidsProducts);
  }, [normalized]);

  const isJuniorsRoot = isJuniorsSlug(slug);
  const isMenWomenOrJuniorSubpage = isMenSlug(slug) || isWomenSlug(slug) || (!isJuniorsRoot && label !== "Category");

  if (isJuniorsRoot) {
    return (
      <div className="space-y-8">
        <BannerBlock
          title="Juniors Wardrobe"
          subtitle="Curated edits for toddlers and juniors with consistent section navigation."
          image="https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=1800"
        />

        <section className="space-y-4">
          <div className="space-y-2 border-b border-zinc-300 pb-3">
            <h3 className="font-heading text-3xl uppercase tracking-[0.06em]">Shop by Group</h3>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Toddler Boys", href: "/category/toddler-boys", image: "https://images.unsplash.com/photo-1519238363430-6d56c844d0a5?w=1200" },
              { label: "Junior Boys", href: "/category/junior-boys", image: "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=1200" },
              { label: "Toddler Girls", href: "/category/toddler-girls", image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1200" },
              { label: "Junior Girls", href: "/category/junior-girls", image: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=1200" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group relative flex min-h-64 items-end overflow-hidden border border-zinc-300 bg-zinc-50 p-4 transition hover:border-black"
              >
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={`${item.label}`}
                    fill
                    sizes="(max-width: 1200px) 25vw, 20vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <span className="relative mt-auto block text-sm font-semibold uppercase tracking-[0.1em] text-white">{item.label}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-2 border-b border-zinc-300 pb-3">
            <h3 className="font-heading text-3xl uppercase tracking-[0.06em]">Category Switch</h3>
          </div>
          <ProductTypesSwitch value={selectedType} onChange={setSelectedType} />
        </section>

        {JUNIOR_GROUPS.map((group) => {
          const rows = (juniorsGroups[group] || []).filter((item) => item.productType === selectedType);
          return (
            <SectionBlock
              key={group}
              title={group}
              helper={`${selectedType} products`}
              products={rows.length ? rows : (juniorsGroups[group] || []).slice(0, 24)}
            />
          );
        })}
      </div>
    );
  }

  if (isMenWomenOrJuniorSubpage) {
    return (
      <div className="space-y-8">
        <BannerBlock
          title={`${label} Collection`}
          subtitle="Built with a persistent section structure: category cards, core product rows, and trend/style rows."
          image={
            isMenSlug(slug)
              ? "https://images.unsplash.com/photo-1516826957135-700dedea698c?w=1800"
              : isWomenSlug(slug)
                ? "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=1800"
                : "https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=1800"
          }
        />

        <section className="space-y-4">
          <div className="space-y-2 border-b border-zinc-300 pb-3">
            <h3 className="font-heading text-3xl uppercase tracking-[0.06em]">Shop by Category</h3>
          </div>
          <ScrollCategoryCards items={categoryCards} />
        </section>

        {sections.map((section) => (
          <SectionBlock key={section.title} title={section.title} products={section.products} helper={section.helper} />
        ))}
      </div>
    );
  }

  return (
    <section className="border border-zinc-300 p-8 text-center">
      <p className="font-heading text-3xl uppercase">Category not found</p>
      <p className="mt-2 text-sm text-zinc-600">Try Men, Women, Juniors, or junior subgroup pages.</p>
    </section>
  );
}
