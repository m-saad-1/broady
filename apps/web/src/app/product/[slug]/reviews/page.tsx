import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, getProductReviews } from "@/lib/api";
import { ReviewSection } from "@/components/ui/review-section";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return {
      title: "Reviews Not Found | BROADY",
    };
  }

  return {
    title: `${product.name} Reviews | BROADY`,
    description: `Read all customer reviews for ${product.name}.`,
  };
}

export default async function ProductReviewsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) return notFound();

  const reviews = await getProductReviews(product.id, { limit: 3, skip: 0, sort: "helpful" });

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Product Reviews</p>
        <h1 className="font-heading text-5xl uppercase">{product.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/product/${product.slug}`} className="border border-zinc-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]">
            Back to Product
          </Link>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-600">{reviews.total} total reviews</p>
        </div>
      </header>

      <ReviewSection
        productId={product.id}
        productSlug={product.slug}
        initialAggregate={reviews.aggregate}
        initialReviews={reviews.items}
        initialTotal={reviews.total}
        pageSize={3}
        showViewAllButton={false}
        enableFilters
      />
    </main>
  );
}
