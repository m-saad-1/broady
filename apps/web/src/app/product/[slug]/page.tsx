import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ui/product-card";
import { getProduct, getProducts } from "@/lib/api";
import { ProductDetailClient } from "./product-detail-client";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return {
      title: "Product Not Found | BROADY",
    };
  }

  return {
    title: `${product.name} | BROADY`,
    description: product.description,
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  const products = await getProducts();

  if (!product) return notFound();

  const sameTopCategory = products.filter((item) => item.topCategory === product.topCategory && item.id !== product.id);
  const sameSubcategory = sameTopCategory.filter((item) => item.subCategory === product.subCategory);
  const related = (sameSubcategory.length ? sameSubcategory : sameTopCategory).slice(0, 4);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-12 px-4 py-10 lg:px-10">
      <ProductDetailClient product={product} />

      <section className="space-y-5">
        <h2 className="font-heading text-3xl uppercase">Related Pieces</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((item) => (
            <ProductCard key={item.id} product={item} />
          ))}
        </div>
      </section>
    </main>
  );
}
