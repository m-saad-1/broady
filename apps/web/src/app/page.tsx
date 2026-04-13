import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { TopPromoBanner } from "@/components/layout/top-promo-banner";
import { ProductCarouselRow } from "@/components/ui/product-carousel-row";
import { getBrands, getProducts } from "@/lib/api";

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
    <section className="space-y-5">
      <SectionHeader title={title} eyebrow={eyebrow} ctaLabel={ctaLabel} href={href} />
      {children}
    </section>
  );
}

export default async function Home() {
  const [brands, products] = await Promise.all([getBrands(), getProducts()]);
  const forYou = products.slice(4, 8);
  const trending = products.slice(8, 16);
  const seasonalHighlights = products
    .filter((product) => product.subCategory === "Outerwear" || product.subCategory === "Footwear" || product.subCategory === "Jackets")
    .slice(0, 3);
  const newArrivals = products.slice(0, 4);
  const featuredBrands = brands.slice(0, 3);
  const categoryHighlights = [
    { name: "Men", image: "https://images.unsplash.com/photo-1516826957135-700dedea698c?w=1200", href: "/category/Men" },
    { name: "Women", image: "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=1200", href: "/category/Women" },
    { name: "Kids", image: "https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=1200", href: "/category/Kids" },
  ];

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-14 px-4 py-8 lg:px-10 lg:py-12">
      <TopPromoBanner
        slides={[
          {
            message: "Mid-season markdowns are live: up to 25% off selected edits",
            imageUrl: "https://images.unsplash.com/photo-1464863979621-258859e62245?w=2000",
            alt: "Models walking during fashion showcase",
          },
          {
            message: "New arrivals from Outfitters, Breakout, and Cougar just landed",
            imageUrl: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=2000",
            alt: "Modern storefront with seasonal collection",
          },
          {
            message: "Members get early access to weekly limited drops",
            imageUrl: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=2000",
            alt: "Editorial fashion model portrait",
          },
        ]}
      />

      <section className="border border-black bg-black px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white">
        Free nationwide shipping over PKR 7,500 | New season editorial drop live now
      </section>

      <GridSection title="Featured Collection" eyebrow="Curated first-look edit" href="/catalog" ctaLabel="Explore Catalog">
        <div className="grid gap-4 md:grid-cols-3">
          {categoryHighlights.map((collection) => (
            <Link key={collection.name} href={collection.href} className="group relative aspect-[5/6] overflow-hidden border border-zinc-300">
              <Image
                src={collection.image}
                alt={`${collection.name} collection`}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <p className="font-heading text-4xl uppercase">{collection.name}</p>
                <p className="text-xs uppercase tracking-[0.12em]">Explore Collection</p>
              </div>
            </Link>
          ))}
        </div>
      </GridSection>

      <GridSection title="For You" eyebrow="Tailored discovery" href="/wishlist" ctaLabel="Build Your Edit">
        <ProductCarouselRow products={forYou} label="For You" />
      </GridSection>

      <GridSection title="Trending Products" eyebrow="Most-viewed right now" href="/catalog" ctaLabel="See All">
        <ProductCarouselRow products={trending} label="Trending Products" />
      </GridSection>

      <GridSection title="Seasonal Highlights" eyebrow="Outerwear and footwear focus" href="/catalog?subCategory=Footwear" ctaLabel="Shop seasonal">
        <div className="grid gap-6 border border-zinc-300 p-5 md:grid-cols-12 md:p-8">
          <div className="space-y-4 md:col-span-5">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Seasonal Highlight</p>
            <h2 className="font-heading text-5xl uppercase leading-[0.92]">Monochrome Winter Utility</h2>
            <p className="text-sm leading-7 text-zinc-700">
              Precision outerwear, tonal layering, and essential footwear selected for the upcoming season.
            </p>
            <Link
              href="/catalog?subCategory=Footwear"
              className="inline-flex border border-black bg-black px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-zinc-900"
            >
              Shop Seasonal Edit
            </Link>
          </div>
          <div className="grid gap-4 md:col-span-7 md:grid-cols-3">
            {seasonalHighlights.map((item) => (
              <article key={item.id} className="space-y-2 border border-zinc-300 p-3">
                <div className="relative aspect-[3/4] overflow-hidden border border-zinc-200">
                  <Image src={item.imageUrl} alt={item.name} fill sizes="(max-width: 768px) 100vw, 20vw" className="object-cover" />
                </div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{item.topCategory} / {item.subCategory}</p>
                <p className="text-sm font-medium uppercase tracking-[0.08em]">{item.name}</p>
              </article>
            ))}
          </div>
        </div>
      </GridSection>

      <GridSection title="New Arrivals" eyebrow="Latest additions from the catalog" href="/catalog" ctaLabel="Browse Latest">
        <ProductCarouselRow products={newArrivals} label="New Arrivals" />
      </GridSection>

      <GridSection title="Brand Showcase" eyebrow="Verified labels on BROADY" href="/brands" ctaLabel="View All Brands">
        <div className="grid gap-4 md:grid-cols-3">
          {featuredBrands.map((brand) => (
            <article key={brand.id} className="border border-zinc-300 p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Verified Brand</p>
              <h2 className="mt-3 font-heading text-3xl uppercase tracking-[0.06em]">{brand.name}</h2>
              <p className="mt-2 text-sm leading-7 text-zinc-700">{brand.description || "Premium high-street label in Pakistan."}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.14em] text-zinc-600">{brand.slug}</p>
              <Link
                href={`/brand/${brand.slug}`}
                className="mt-4 inline-flex border border-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition hover:bg-black hover:text-white"
              >
                Explore
              </Link>
            </article>
          ))}
        </div>
      </GridSection>

      <GridSection title="Customer Reviews" eyebrow="Social proof from shoppers" href="/register" ctaLabel="Join BROADY">
        <div className="grid gap-5 md:grid-cols-12">
          <div className="space-y-4 border border-zinc-300 p-6 md:col-span-7">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Customer Reviews</p>
            <blockquote className="font-heading text-4xl uppercase leading-[1]">
              &quot;Finally a marketplace where premium Pakistani western brands feel curated, not cluttered.&quot;
            </blockquote>
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-600">Areeba K. | Lahore</p>
            <div className="grid grid-cols-3 gap-3 border-t border-zinc-200 pt-4 text-center">
              <div>
                <p className="font-heading text-3xl">4.8/5</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">Avg. Rating</p>
              </div>
              <div>
                <p className="font-heading text-3xl">12k+</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">Monthly Visits</p>
              </div>
              <div>
                <p className="font-heading text-3xl">96%</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">Repeat Buyers</p>
              </div>
            </div>
          </div>
          <aside className="space-y-4 border border-zinc-300 p-6 md:col-span-5">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Trust Signals</p>
            <ul className="space-y-3 text-sm leading-7 text-zinc-700">
              <li>Verified brand onboarding and product moderation pipeline.</li>
              <li>Secure checkout with JazzCash, Easypaisa, and Cash on Delivery.</li>
              <li>Mobile-optimized PWA performance with offline-ready browsing support.</li>
            </ul>
            <Link
              href="/register"
              className="inline-flex border border-black px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] transition hover:bg-black hover:text-white"
            >
              Join BROADY
            </Link>
          </aside>
        </div>
      </GridSection>
    </main>
  );
}
