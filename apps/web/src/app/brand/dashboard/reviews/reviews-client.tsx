"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ProductImage } from "@/components/ui/product-image";
import { getBrandReviews, replyToReview } from "@/lib/api";
import { useToastStore } from "@/stores/toast-store";
import type { ProductReview } from "@/types/marketplace";

export function BrandReviewsClient() {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyByReview, setReplyByReview] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
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
          <div className="flex flex-wrap items-start gap-3">
            {review.product?.imageUrl ? (
              <button type="button" onClick={() => setActiveImageUrl(resolveProductImageSrc(review.product?.imageUrl))} className="relative h-16 w-16 overflow-hidden border border-zinc-200 bg-zinc-50">
                <ProductImage
                  src={resolveProductImageSrc(review.product.imageUrl)}
                  alt={review.product.name || "Product"}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <Link href={review.product?.slug ? `/product/${review.product.slug}` : "/brand/products"} className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700 underline decoration-zinc-400 underline-offset-2">
                    {review.product?.name || "Product"}
                  </Link>
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{review.rating}/5 • {review.status}</p>
                </div>
                <Link href={review.product?.slug ? `/product/${review.product.slug}#reviews` : "/brand/products"} className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">
                  Open All Reviews
                </Link>
              </div>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-zinc-500">Customer: {review.user.fullName}</p>
              <div className="mt-1 flex flex-wrap gap-3 text-xs uppercase tracking-[0.1em] text-zinc-600">
                <span><span className="font-semibold text-zinc-700">Color:</span> {review.orderItem?.selectedColor || "N/A"}</span>
                <span><span className="font-semibold text-zinc-700">Size:</span> {review.orderItem?.selectedSize || "N/A"}</span>
              </div>
            </div>
          </div>

          <p className="mt-2 text-sm leading-7 text-zinc-700">{review.content}</p>

          {review.images.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {review.images.map((image) => (
                <button key={image.id} type="button" onClick={() => setActiveImageUrl(resolveProductImageSrc(image.url))} className="relative h-20 w-20 overflow-hidden border border-zinc-200 bg-zinc-50">
                  <ProductImage src={resolveProductImageSrc(image.url)} alt="Review" fill sizes="80px" className="object-cover" />
                </button>
              ))}
            </div>
          ) : null}

          {review.brandReply ? (
            <div className="mt-3 border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">Brand reply</p>
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

      {activeImageUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" onClick={() => setActiveImageUrl(null)}>
          <button type="button" className="absolute right-4 top-4 h-10 border border-white px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white" onClick={() => setActiveImageUrl(null)}>
            Close
          </button>
          <div className="relative h-[80vh] w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <ProductImage src={activeImageUrl} alt="Review image" fill sizes="100vw" className="object-contain" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
