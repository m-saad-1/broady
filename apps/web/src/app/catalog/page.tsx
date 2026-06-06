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
  const allProducts = await getProducts({ limit: "5000" });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-8 lg:px-10">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Catalog</p>
      </header>

      <CatalogClient initialProducts={products} allProducts={allProducts} params={safeParams} />
    </main>
  );
}
