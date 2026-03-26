import { getProducts } from "@/lib/api";
import { normalizeProduct } from "@/lib/taxonomy";
import { CategoryCollectionClient } from "./category-collection-client";

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  return {
    title: `${category} | BROADY Fashion Category`,
    description: `Shop ${category} from Pakistan's verified western fashion brands on BROADY.`,
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const products = (await getProducts({ topCategory: category })).map(normalizeProduct);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Category</p>
        <h1 className="font-heading text-5xl uppercase">{category}</h1>
      </header>

      <CategoryCollectionClient products={products} category={category} />
    </main>
  );
}
