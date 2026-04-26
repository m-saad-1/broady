import { getProducts } from "@/lib/api";
import { normalizeProduct } from "@/lib/taxonomy";
import { CategoryCollectionClient } from "./category-collection-client";

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const normalized = decodeURIComponent(category).trim().toLowerCase();
  const displayCategory =
    normalized === "juniors" || normalized === "kids"
      ? "Juniors"
      : normalized === "junior-boys"
        ? "Junior Boys"
        : normalized === "toddler-boys"
          ? "Toddler Boys"
          : normalized === "junior-girls"
            ? "Junior Girls"
            : normalized === "toddler-girls"
              ? "Toddler Girls"
              : normalized === "men"
                ? "Men"
                : normalized === "women"
                  ? "Women"
                  : "Category";
  return {
    title: `${displayCategory} | BROADY Fashion Category`,
    description: `Shop ${displayCategory} from Pakistan's verified western fashion brands on BROADY.`,
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const products = (await getProducts()).map(normalizeProduct);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <CategoryCollectionClient products={products} categorySlug={category} />
    </main>
  );
}
