import Image from "next/image";
import Link from "next/link";
import { TopPromoBanner } from "@/components/layout/top-promo-banner";
import { ProductCard } from "@/components/ui/product-card";
import { getBrands, getProducts } from "@/lib/api";

export default async function Home() {
  const [brands, products] = await Promise.all([getBrands(), getProducts()]);
  const trending = products.slice(0, 8);
  const seasonal = products.filter((product) => product.subCategory === "Outerwear" || product.subCategory === "Footwear").slice(0, 3);
  const topPicks = products.slice(3, 7);

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

      <section className="grid gap-6 border border-zinc-300 p-4 md:grid-cols-12 md:p-8">
        <div className="space-y-6 md:col-span-5">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-600">Pakistan Multi-Brand Fashion Marketplace</p>
          <h1 className="font-heading text-5xl uppercase leading-[0.92] tracking-[0.04em] md:text-7xl">
            WESTERN
            <br />
            EDITION
          </h1>
          <p className="max-w-md text-sm leading-7 text-zinc-700">
            BROADY unifies verified high-street labels like Outfitters, Breakout, and Cougar into one fast,
            premium marketplace designed for discovery, comparison, and confident checkout.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/catalog" className="border border-black bg-black px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white">
              Shop Now
            </Link>
            <Link href="/brands" className="border border-black bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em]">
              Discover Brands
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-zinc-200 pt-4 text-center">
            <article>
              <p className="font-heading text-3xl">3+</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">Verified Brands</p>
            </article>
            <article>
              <p className="font-heading text-3xl">18+</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">Live Collections</p>
            </article>
            <article>
              <p className="font-heading text-3xl">24h</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">Order Window</p>
            </article>
          </div>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden border border-zinc-300 md:col-span-7 md:aspect-auto md:min-h-[540px]">
          <Image
            src="https://images.unsplash.com/photo-1445205170230-053b83016050?w=1600"
            alt="BROADY Hero Editorial"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-cover"
          />
        </div>
      </section>

      <section className="border border-black bg-black px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white">
        Free nationwide shipping over PKR 7,500 | New season editorial drop live now
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between border-b border-zinc-300 pb-3">
          <h2 className="font-heading text-3xl uppercase tracking-[0.06em]">Featured Collections</h2>
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Curated by category</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { name: "Men", image: "https://images.unsplash.com/photo-1516826957135-700dedea698c?w=1200", href: "/category/Men" },
            { name: "Women", image: "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=1200", href: "/category/Women" },
            { name: "Kids", image: "https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=1200", href: "/category/Kids" },
          ].map((collection) => (
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
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between border-b border-zinc-300 pb-3">
          <h2 className="font-heading text-3xl uppercase tracking-[0.06em]">Brand Showcase</h2>
          <Link href="/brands" className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600">
            View all brands
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
        {brands.map((brand) => (
          <article key={brand.id} className="border border-zinc-300 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Verified Brand</p>
            <h2 className="mt-3 font-heading text-3xl uppercase tracking-[0.06em]">{brand.name}</h2>
            <p className="mt-2 text-sm leading-7 text-zinc-700">{brand.description || "Premium high-street label in Pakistan."}</p>
            <p className="mt-4 text-xs uppercase tracking-[0.14em] text-zinc-600">{brand.slug}</p>
            <Link href={`/brand/${brand.slug}`} className="mt-4 inline-flex border border-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em]">
              Explore
            </Link>
          </article>
        ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between border-b border-zinc-300 pb-3">
          <h2 className="font-heading text-3xl uppercase tracking-[0.06em]">Trending Products</h2>
          <Link href="/catalog" className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600">
            Explore all
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {trending.slice(0, 6).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 border border-zinc-300 p-5 md:grid-cols-12 md:p-8">
        <div className="space-y-4 md:col-span-5">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Seasonal Highlight</p>
          <h2 className="font-heading text-5xl uppercase leading-[0.92]">Monochrome Winter Utility</h2>
          <p className="text-sm leading-7 text-zinc-700">
            Precision outerwear, tonal layering, and essential footwear selected for the upcoming season.
          </p>
          <Link href="/catalog?subCategory=Footwear" className="inline-flex border border-black bg-black px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white">
            Shop Seasonal Edit
          </Link>
        </div>
        <div className="grid gap-4 md:col-span-7 md:grid-cols-3">
          {seasonal.map((item) => (
            <article key={item.id} className="space-y-2 border border-zinc-300 p-3">
              <div className="relative aspect-[3/4] overflow-hidden border border-zinc-200">
                <Image src={item.imageUrl} alt={item.name} fill sizes="(max-width: 768px) 100vw, 20vw" className="object-cover" />
              </div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{item.topCategory} / {item.subCategory}</p>
              <p className="text-sm font-medium uppercase tracking-[0.08em]">{item.name}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between border-b border-zinc-300 pb-3">
          <h2 className="font-heading text-3xl uppercase tracking-[0.06em]">Top Picks For You</h2>
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Future-ready personalization slot</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {topPicks.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-12">
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
          <Link href="/register" className="inline-flex border border-black px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em]">
            Join BROADY
          </Link>
        </aside>
      </section>
    </main>
  );
}
