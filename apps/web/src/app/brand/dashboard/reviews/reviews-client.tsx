"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ProductImage } from "@/components/ui/product-image";
import { getBrandReviews, replyToReview } from "@/lib/api";
import { useToastStore } from "@/stores/toast-store";
import type { ProductReview } from "@/types/marketplace";

type BrandReviewsClientProps = {
  brandName: string;
};

export function BrandReviewsClient({ brandName }: BrandReviewsClientProps) {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyByReview, setReplyByReview] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const pushToast = useToastStore((state) => state.pushToast);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBrandReviews(50, 0);
      setReviews(data);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Failed to load brand reviews", "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const onReply = async (event: FormEvent<HTMLFormElement>, reviewId: string) => {
    event.preventDefault();
    const content = (replyByReview[reviewId] || "").trim();
    if (!content) {
      pushToast("Reply message is required", "error");
      return;
    }

    try {
      setSubmittingId(reviewId);
      await replyToReview(reviewId, content);
      pushToast("Reply published", "success");
      setReplyByReview((current) => ({ ...current, [reviewId]: "" }));
      await load();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Failed to publish reply", "error");
    } finally {
      setSubmittingId(null);
    }
  };

  const resolveProductImageSrc = (imageUrl?: string) => {
    const normalized = (imageUrl || "").trim();
    return normalized || "/window.svg";
  };

  if (loading) {
    return <p className="text-sm text-zinc-700">Loading reviews...</p>;
  }

  if (!reviews.length) {
    return (
      <section className="border border-zinc-300 p-6">
        <p className="text-sm text-zinc-700">No reviews found for this brand yet.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {reviews.map((review) => (
        <article key={review.id} className="border border-zinc-300 p-4">
          <Link href={review.product?.slug ? `/product/${review.product.slug}/reviews` : "/brand/dashboard/reviews"} className="block">
            <div className="flex flex-wrap items-start gap-3">
              {review.product?.imageUrl ? (
                <div className="relative h-16 w-16 overflow-hidden border border-zinc-200 bg-zinc-50">
                  <ProductImage
                    src={resolveProductImageSrc(review.product.imageUrl)}
                    alt={review.product.name || "Product"}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                    {review.product?.name || "Product"} • {review.rating}/5 • {review.status}
                  </p>
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">View Reviews</p>
                </div>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-zinc-500">Customer: {review.user.fullName}</p>
              </div>
            </div>
          </Link>

          <p className="mt-2 text-sm leading-7 text-zinc-700">{review.content}</p>

          {review.brandReply ? (
            <div className="mt-3 border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">Reply from {brandName}</p>
              <p className="mt-2 text-sm text-zinc-700">{review.brandReply.content}</p>
            </div>
          ) : null}

          <form className="mt-4 space-y-2" onSubmit={(event) => void onReply(event, review.id)}>
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">Public reply</label>
            <textarea
              className="min-h-24 w-full border border-zinc-300 p-3 text-sm"
              value={replyByReview[review.id] ?? review.brandReply?.content ?? ""}
              onChange={(event) =>
                setReplyByReview((current) => ({
                  ...current,
                  [review.id]: event.target.value,
                }))
              }
              placeholder="Reply from your brand"
            />
            <button
              type="submit"
              disabled={submittingId === review.id}
              className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
            >
              {submittingId === review.id ? "Saving..." : review.brandReply ? "Update Reply" : "Publish Reply"}
            </button>
          </form>
        </article>
      ))}
    </section>
  );
}
