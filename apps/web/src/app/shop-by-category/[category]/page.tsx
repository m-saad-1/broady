import { CatalogClient } from "@/app/catalog/catalog-client";
import { getProducts } from "@/lib/api";

type ShopByCategoryProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const decoded = decodeURIComponent(category);
  return {
    title: `${decoded} | Shop by Category | BROADY`,
    description: `Browse all ${decoded} products with catalog filters and search controls.`,
  };
}

export default async function ShopByCategoryPage({ params, searchParams }: ShopByCategoryProps) {
  const { category } = await params;
  const query = await searchParams;
  const decodedCategory = decodeURIComponent(category);
  const topCategoryFromQuery = typeof query.topCategory === "string" ? query.topCategory : "";

  const safeParams: Record<string, string> = {
    subCategory: decodedCategory,
  };

  if (topCategoryFromQuery) {
    safeParams.topCategory = topCategoryFromQuery;
  }

  const products = await getProducts(safeParams);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-6">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Shop by Category</p>
        <h1 className="font-heading text-5xl uppercase">{decodedCategory}</h1>
      </header>

      <CatalogClient initialProducts={products} params={safeParams} />
    </main>
  );
}
