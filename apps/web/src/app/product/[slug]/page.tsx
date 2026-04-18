import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ui/product-card";
import { getProduct, getProductReviews, getProducts } from "@/lib/api";
import { ReviewSection } from "@/components/ui/review-section";
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

  let reviewSummary: {
    aggregate: {
      averageRating: number;
      totalReviews: number;
      rating1: number;
      rating2: number;
      rating3: number;
      rating4: number;
      rating5: number;
    };
    averageRating: number;
    totalReviews: number;
    items: Array<{
      id: string;
      rating: number;
      content: string;
      user: { fullName: string };
      images: Array<{ id: string; url: string; sortOrder: number }>;
      brandReply?: {
        id: string;
        brandId: string;
        userId: string;
        content: string;
        createdAt: string;
        updatedAt: string;
        user: { id: string; fullName: string };
      } | null;
      isVerifiedPurchase: boolean;
      createdAt: string;
    }>;
  } = {
    aggregate: {
      averageRating: 0,
      totalReviews: 0,
      rating1: 0,
      rating2: 0,
      rating3: 0,
      rating4: 0,
      rating5: 0,
    },
    averageRating: 0,
    totalReviews: 0,
    items: [],
  };

  try {
    const reviews = await getProductReviews(product.id, { limit: 3, skip: 0, sort: "helpful" });
    reviewSummary = {
      aggregate: reviews.aggregate,
      averageRating: reviews.aggregate.averageRating,
      totalReviews: reviews.aggregate.totalReviews,
      items: reviews.items,
    };
  } catch {
    // Keep product page resilient if reviews API is unavailable.
  }

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

      <ReviewSection
        productId={product.id}
        productSlug={product.slug}
        initialAggregate={reviewSummary.aggregate}
        initialReviews={reviewSummary.items as any}
        initialTotal={reviewSummary.totalReviews}
        pageSize={3}
        showViewAllButton
      />
    </main>
  );
}
