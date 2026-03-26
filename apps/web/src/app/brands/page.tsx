import Link from "next/link";
import { getBrands } from "@/lib/api";

export const metadata = {
  title: "Verified Fashion Brands | BROADY",
  description: "Browse verified Western fashion brands in Pakistan including Outfitters, Breakout, and Cougar.",
};

export default async function BrandsPage() {
  const brands = await getBrands();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Directory</p>
        <h1 className="font-heading text-5xl uppercase tracking-[0.06em]">Verified Brands</h1>
      </header>

      {brands.length ? (
        <section className="grid gap-4 md:grid-cols-3">
          {brands.map((brand) => (
            <article key={brand.id} className="border border-zinc-300 bg-white p-6">
              <h2 className="font-heading text-3xl uppercase">{brand.name}</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-700">{brand.description || "Verified western fashion label."}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.12em] text-zinc-600">Slug: {brand.slug}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-zinc-600">Status: {brand.verified ? "Verified" : "Pending"}</p>
              <Link href={`/brand/${brand.slug}`} className="mt-4 inline-flex border border-black bg-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                View Brand
              </Link>
            </article>
          ))}
        </section>
      ) : (
        <section className="border border-zinc-300 p-8 text-center">
          <p className="font-heading text-3xl uppercase">This product is not available</p>
          <p className="mt-2 text-sm text-zinc-600">No brand inventory is currently available.</p>
        </section>
      )}
    </main>
  );
}
