import Image from "next/image";
import { notFound } from "next/navigation";
import { getBrandBySlug } from "@/lib/api";
import { BrandCollectionClient } from "./brand-collection-client";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);

  if (!brand) return { title: "Brand Not Found | BROADY" };

  return {
    title: `${brand.name} Collections | BROADY`,
    description: brand.description || `Shop ${brand.name} collections on BROADY.`,
  };
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);

  if (!brand) notFound();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <section className="grid gap-6 border border-zinc-300 p-6 md:grid-cols-12">
        <div className="md:col-span-8 space-y-4">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Brand Identity</p>
          <h1 className="font-heading text-5xl uppercase tracking-[0.06em]">{brand.name}</h1>
          <p className="max-w-2xl text-sm leading-7 text-zinc-700">{brand.description || "Verified fashion brand on BROADY."}</p>
        </div>
        {brand.logoUrl ? (
          <div className="relative aspect-[4/3] overflow-hidden border border-zinc-300 md:col-span-4">
            <Image src={brand.logoUrl} alt={brand.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 30vw" />
          </div>
        ) : null}
      </section>

      <BrandCollectionClient products={brand.products} />
    </main>
  );
}
