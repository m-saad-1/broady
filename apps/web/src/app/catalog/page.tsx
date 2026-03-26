import { CatalogClient } from "@/app/catalog/catalog-client";
import { getProducts } from "@/lib/api";

export const metadata = {
  title: "Fashion Catalog | BROADY",
  description: "Filter products by brand, top category, subcategory, price, and size from Pakistan's verified high-street labels.",
};

type CatalogProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CatalogPage({ searchParams }: CatalogProps) {
  const params = await searchParams;
  const safeParams = Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => [key, value as string]),
  );

  const products = await getProducts(safeParams);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-6">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Catalog</p>
        <h1 className="font-heading text-5xl uppercase">Product Grid</h1>
      </header>

      <CatalogClient initialProducts={products} params={safeParams} />
    </main>
  );
}
