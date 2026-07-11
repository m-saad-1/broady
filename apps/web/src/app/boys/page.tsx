import { CatalogClient } from "@/app/catalog/catalog-client";
import { getProducts } from "@/lib/api";

export const metadata = {
  title: "Boys Fashion | BROADY",
  description: "Shop the latest trends in boys clothing, footwear, and accessories from top Pakistani brands",
};

export default async function BoysPage() {
  const params = { topCategory: "Junior Boys" };
  const products = await getProducts(params);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-8 lg:px-10">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Boys Collection</p>
      </header>
      <CatalogClient initialProducts={products} params={params} />
    </main>
  );
}
