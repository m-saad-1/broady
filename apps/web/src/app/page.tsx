import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { TopPromoBanner } from "@/components/layout/top-promo-banner";
import { PersonalizedForYouSection } from "@/components/ui/personalized-for-you-section";
import { ProductCarouselRow } from "@/components/ui/product-carousel-row";
import { RecommendedProductCarouselRow } from "@/components/ui/recommended-product-carousel-row";
import { getProducts } from "@/lib/api";

function SectionHeader({ title, eyebrow, ctaLabel, href }: { title: string; eyebrow?: string; ctaLabel?: string; href?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-zinc-300 pb-3">
      <div className="space-y-2">
        {eyebrow ? <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{eyebrow}</p> : null}
        <h2 className="font-heading text-3xl uppercase tracking-[0.06em] md:text-4xl">{title}</h2>
      </div>
      {href && ctaLabel ? (
        <Link
          href={href}
          className="relative text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600 transition-colors hover:text-black after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-black after:transition-transform after:duration-200 hover:after:scale-x-100"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}

function GridSection({
  title,
  eyebrow,
  ctaLabel,
  href,
  children,
}: {
  title: string;
  eyebrow?: string;
  ctaLabel?: string;
  href?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-5 overflow-x-hidden">
      <SectionHeader title={title} eyebrow={eyebrow} ctaLabel={ctaLabel} href={href} />
      {children}
    </section>
  );
}

export default async function Home() {
  const products = await getProducts();
  const trending = products.slice(0, 16);
  const menProducts = products.filter((product) => product.topCategory === "Men").slice(0, 16);
  const womenProducts = products.filter((product) => product.topCategory === "Women").slice(0, 16);
  const boysProducts = products.filter((product) => ["Junior Boys", "Toddler Boys"].includes(product.topCategory)).slice(0, 16);
  const girlsProducts = products.filter((product) => ["Junior Girls", "Toddler Girls"].includes(product.topCategory)).slice(0, 16);
  const categoryHighlights = [
    { name: "Men", image: "https://images.unsplash.com/photo-1516826957135-700dedea698c?w=1200", href: "/category/Men" },
    { name: "Women", image: "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=1200", href: "/category/Women" },
    { name: "Boys", image: "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=1200", href: "/category/Boys" },
    { name: "Girls", image: "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=1200", href: "/category/Girls" },
  ];

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-14 overflow-x-hidden px-4 py-8 lg:px-10 lg:py-12">
      <TopPromoBanner
        slides={[
          {
            message: "Summer essentials are live: light layers, breathable sets, and warm-weather staples",
            imageUrl: "https://images.unsplash.com/photo-1464863979621-258859e62245?w=2000",
            alt: "Models walking during fashion showcase",
          },
          {
            message: "Fresh summer picks from Outfitters, Breakout, and Cougar",
            imageUrl: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=2000",
            alt: "Modern storefront with seasonal collection",
          },
          {
            message: "Members get early access to weekly summer capsule drops",
            imageUrl: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=2000",
            alt: "Editorial fashion model portrait",
          },
        ]}
      />

      <section className="border border-black bg-black px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white break-words">
        Free nationwide shipping over PKR 7,500 | New season editorial drop live now
      </section>

      <GridSection title="Featured Collection" eyebrow="Curated first-look edit" href="/catalog" ctaLabel="Explore Catalog">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {categoryHighlights.map((collection) => (
            <Link key={collection.name} href={collection.href} className="group relative aspect-[4/5] overflow-hidden border border-zinc-300">
              <Image
                src={collection.image}
                alt={`${collection.name} collection`}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <p className="font-heading text-3xl uppercase md:text-4xl">{collection.name}</p>
                <p className="text-xs uppercase tracking-[0.12em]">Explore Collection</p>
              </div>
            </Link>
          ))}
        </div>
      </GridSection>

      <PersonalizedForYouSection products={products} />

      <GridSection title="Men" eyebrow="Category spotlight" href="/category/Men" ctaLabel="View Men">
        <div className="min-w-0 overflow-x-hidden">
          <RecommendedProductCarouselRow products={menProducts} label="Men" topCategory="Men" source="home-men" />
        </div>
      </GridSection>

      <GridSection title="Women" eyebrow="Category spotlight" href="/category/Women" ctaLabel="View Women">
        <div className="min-w-0 overflow-x-hidden">
          <RecommendedProductCarouselRow products={womenProducts} label="Women" topCategory="Women" source="home-women" />
        </div>
      </GridSection>

      <GridSection title="Boys" eyebrow="Category spotlight" href="/category/Boys" ctaLabel="View Boys">
        <div className="min-w-0 overflow-x-hidden">
          <RecommendedProductCarouselRow products={boysProducts} label="Boys" topCategory="Junior Boys" source="home-boys" />
        </div>
      </GridSection>

      <GridSection title="Girls" eyebrow="Category spotlight" href="/category/Girls" ctaLabel="View Girls">
        <div className="min-w-0 overflow-x-hidden">
          <RecommendedProductCarouselRow products={girlsProducts} label="Girls" topCategory="Junior Girls" source="home-girls" />
        </div>
      </GridSection>

      <GridSection title="Trending" eyebrow="Most-viewed right now" href="/catalog" ctaLabel="See All">
        <div className="min-w-0 overflow-x-hidden">
          <ProductCarouselRow products={trending} label="Trending" />
        </div>
      </GridSection>
    </main>
  );
}
