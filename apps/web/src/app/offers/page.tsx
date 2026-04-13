import Link from "next/link";
import { ProductCard } from "@/components/ui/product-card";
import { getProducts } from "@/lib/api";
import { fallbackProducts } from "@/lib/mock-data";
import { hasActiveOffer } from "@/lib/pricing";
import { normalizeProduct } from "@/lib/taxonomy";

export default async function OffersPage() {
  const products = await getProducts();
  const offeredProducts = products.filter(hasActiveOffer);
  const fallbackOffered = fallbackProducts.map(normalizeProduct).filter(hasActiveOffer);
  const list = offeredProducts.length ? offeredProducts : fallbackOffered;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Price Drops</p>
        <h1 className="font-heading text-5xl uppercase">Offers</h1>
        <p className="max-w-3xl text-sm leading-7 text-zinc-700">
          Live discounted picks across verified brands. Each card shows current sale price, original price, and active discount percentage.
        </p>
      </header>

      {list.length ? (
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </section>
      ) : (
        <section className="border border-zinc-300 p-6">
          <p className="text-sm text-zinc-700">No active offers right now. Check back soon for flash sales.</p>
          <Link
            href="/catalog"
            className="mt-4 inline-flex border border-black bg-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white"
          >
            Browse Catalog
          </Link>
        </section>
      )}
    </main>
  );
}
