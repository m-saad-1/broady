"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getMyReviews, getProductReviews, getUserOrders, reportReview, voteReviewHelpfulness } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useToastStore } from "@/stores/toast-store";
import type { ProductReview, ProductReviewAggregate, ReviewReportReason } from "@/types/marketplace";

type ReviewSectionProps = {
  productId: string;
  productSlug: string;
  initialAggregate: ProductReviewAggregate;
  initialReviews: ProductReview[];
  initialTotal?: number;
  pageSize?: number;
  showViewAllButton?: boolean;
  enableFilters?: boolean;
};

const reportReasons: ReviewReportReason[] = ["SPAM", "INAPPROPRIATE", "OFFENSIVE_LANGUAGE", "FAKE_REVIEW", "OTHER"];

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < rating ? "text-black" : "text-zinc-300"}>
          ★
        </span>
      ))}
    </div>
  );
}

function resolveReviewImageSrc(imageUrl: string) {
  const normalized = imageUrl.trim();
  if (!normalized) return "/window.svg";
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) return normalized;

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
  return new URL(normalized, apiBase).toString();
}

function RatingPipes({ count, total }: { count: number; total: number }) {
  const filledPipes = total > 0 ? Math.round((count / total) * 20) : 0;

  return (
    <div className="flex h-2 flex-1 gap-0.5 overflow-hidden border border-zinc-300 bg-white" aria-hidden="true">
      {Array.from({ length: 20 }, (_, index) => (
        <span key={index} className={`flex-1 ${index < filledPipes ? "bg-black" : "bg-zinc-100"}`} />
      ))}
    </div>
  );
}

export function ReviewSection({
  productId,
  productSlug,
  initialAggregate,
  initialReviews,
  initialTotal,
  pageSize = 3,
  showViewAllButton = true,
  enableFilters = false,
}: ReviewSectionProps) {
  const user = useAuthStore((state) => state.user);
  const pushToast = useToastStore((state) => state.pushToast);
  const [reviews, setReviews] = useState<ProductReview[]>(initialReviews);
  const [aggregate, setAggregate] = useState(initialAggregate);
  const [total, setTotal] = useState(initialTotal ?? initialAggregate.totalReviews ?? initialReviews.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [reportByReview, setReportByReview] = useState<Record<string, { open: boolean; reason: ReviewReportReason; description: string }>>({});
  const [activeImage, setActiveImage] = useState<{ url: string; alt: string } | null>(null);
  const [sort, setSort] = useState<"newest" | "rating" | "helpful">("helpful");
  const [ratingFilter, setRatingFilter] = useState<number | undefined>(undefined);
  const [writeOrderItemId, setWriteOrderItemId] = useState<string | null>(null);
  const [isPurchasedByUser, setIsPurchasedByUser] = useState(false);

  const reviewCountLabel = useMemo(() => `${aggregate.totalReviews} reviews`, [aggregate.totalReviews]);
  const canLoadMore = reviews.length < total;
  const canWriteReview = Boolean(user && isPurchasedByUser && writeOrderItemId);

  useEffect(() => {
    setReviews(initialReviews);
    setAggregate(initialAggregate);
    setTotal(initialTotal ?? initialAggregate.totalReviews ?? initialReviews.length);
  }, [initialAggregate, initialReviews, initialTotal]);

  useEffect(() => {
    if (!user) {
      setWriteOrderItemId(null);
      setIsPurchasedByUser(false);
      return;
    }

    let mounted = true;
    const resolveReviewEligibility = async () => {
      try {
        const [orders, myReviews] = await Promise.all([getUserOrders(), getMyReviews(200, 0)]);
        if (!mounted) return;

        const deliveredItemsForProduct = orders
          .filter((order) => order.status === "DELIVERED")
          .flatMap((order) => order.items)
          .filter((item) => item.product.id === productId);

        const reviewedOrderItemIds = new Set(
          myReviews.filter((review) => review.productId === productId).map((review) => review.orderItemId),
        );

        const firstAvailable = deliveredItemsForProduct.find((item) => !reviewedOrderItemIds.has(item.id));
        setIsPurchasedByUser(deliveredItemsForProduct.length > 0);
        setWriteOrderItemId(firstAvailable ? firstAvailable.id : null);
      } catch {
        if (!mounted) return;
        setWriteOrderItemId(null);
        setIsPurchasedByUser(false);
      }
    };

    void resolveReviewEligibility();

    return () => {
      mounted = false;
    };
  }, [productId, user]);

  const reloadFirstPage = async (nextSort: "newest" | "rating" | "helpful", nextRating?: number) => {
    setLoadingMore(true);
    try {
      const firstPage = await getProductReviews(productId, {
        limit: pageSize,
        skip: 0,
        sort: nextSort,
        rating: nextRating,
      });
      setReviews(firstPage.items);
      setAggregate(firstPage.aggregate);
      setTotal(firstPage.total);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Unable to load reviews", "error");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!enableFilters) return;
    void reloadFirstPage(sort, ratingFilter);
  }, [enableFilters, sort, ratingFilter]);

  const handleHelpful = async (reviewId: string, isHelpful: boolean) => {
    setBusyKey(`helpful:${reviewId}:${isHelpful}`);
    try {
      await voteReviewHelpfulness(reviewId, isHelpful);
      pushToast("Marked helpful", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Unable to save vote", "error");
    } finally {
      setBusyKey(null);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore) return;

    setLoadingMore(true);
    try {
      const nextPage = await getProductReviews(productId, {
        limit: pageSize,
        skip: reviews.length,
        sort,
        rating: ratingFilter,
      });
      setReviews((current) => [...current, ...nextPage.items]);
      setAggregate(nextPage.aggregate);
      setTotal(nextPage.total);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Unable to load more reviews", "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleReport = async (event: FormEvent<HTMLFormElement>, reviewId: string) => {
    event.preventDefault();
    const draft = reportByReview[reviewId];
    if (!draft) return;

    setBusyKey(`report:${reviewId}`);
    try {
      await reportReview(reviewId, {
        reason: draft.reason,
        description: draft.description.trim() || undefined,
      });
      pushToast("Review reported", "success");
      setReportByReview((current) => ({
        ...current,
        [reviewId]: { open: false, reason: "OTHER", description: "" },
      }));
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Unable to report review", "error");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section className="space-y-5 border border-zinc-300 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl uppercase">Customer Reviews</h2>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-600">
            Avg {aggregate.averageRating.toFixed(1)} / 5 • {reviewCountLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showViewAllButton ? (
            <Link href={`/product/${productSlug}/reviews`} className="border border-zinc-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]">
              View All Reviews
            </Link>
          ) : null}
          {canWriteReview ? (
            <Link href={`/account/reviews?orderItemId=${encodeURIComponent(writeOrderItemId || "")}`} className="border border-black bg-black px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">
              Write Review
            </Link>
          ) : null}
        </div>
      </div>

      {enableFilters ? (
        <div className="flex flex-wrap gap-2 border border-zinc-200 p-3">
          <select className="h-9 border border-zinc-300 px-3 text-xs uppercase" value={sort} onChange={(event) => setSort(event.target.value as "newest" | "rating" | "helpful")}>
            <option value="helpful">Most Helpful</option>
            <option value="newest">Newest</option>
            <option value="rating">Top Rated</option>
          </select>
          <select
            className="h-9 border border-zinc-300 px-3 text-xs uppercase"
            value={ratingFilter ? String(ratingFilter) : "all"}
            onChange={(event) => setRatingFilter(event.target.value === "all" ? undefined : Number(event.target.value))}
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Star</option>
            <option value="4">4 Star</option>
            <option value="3">3 Star</option>
            <option value="2">2 Star</option>
            <option value="1">1 Star</option>
          </select>
        </div>
      ) : null}

      {aggregate.totalReviews ? (
        <div className="grid gap-2 md:grid-cols-[220px_1fr] md:items-start">
          <div className="space-y-2 border border-zinc-200 p-3">
            <p className="text-4xl font-heading">{aggregate.averageRating.toFixed(1)}</p>
            <StarDisplay rating={Math.round(aggregate.averageRating)} />
          </div>
          <div className="space-y-2">
            {([5, 4, 3, 2, 1] as const).map((rating) => {
              const total = aggregate.totalReviews || 1;
              const count = aggregate[`rating${rating}` as keyof ProductReviewAggregate] as number;
              return (
                <div key={rating} className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-zinc-500">
                  <span className="w-4">{rating}</span>
                  <RatingPipes count={count} total={total} />
                  <span className="w-10 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-600">No reviews yet. Be the first to share feedback.</p>
      )}

      <div className="space-y-4">
        {reviews.map((review) => {
          const reportDraft = reportByReview[review.id] || { open: false, reason: "OTHER" as ReviewReportReason, description: "" };
          return (
            <article key={review.id} className="border border-zinc-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{review.user.fullName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{review.isVerifiedPurchase ? "Verified Purchase" : "Review"}</p>
                    {review.product?.name ? <span className="text-xs uppercase tracking-[0.12em] text-zinc-500">Product: {review.product.name}</span> : null}
                    {review.orderItem?.selectedColor && (
                      <span className="text-xs text-zinc-600">
                        Color: <span className="font-semibold">{review.orderItem.selectedColor}</span>
                      </span>
                    )}
                    {review.orderItem?.selectedSize && (
                      <span className="text-xs text-zinc-600">
                        Size: <span className="font-semibold">{review.orderItem.selectedSize}</span>
                      </span>
                    )}
                    {review.orderItem?.order?.id ? (
                      <span className="text-xs text-zinc-600">
                        Order: <span className="font-semibold">{review.orderItem.order.id.slice(0, 10)}...</span>
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="text-right">
                  <StarDisplay rating={review.rating} />
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{new Date(review.createdAt).toLocaleDateString("en-PK")}</p>
                </div>
              </div>

              <p className="mt-2 text-sm leading-7 text-zinc-700">{review.content}</p>

              {review.images.length ? (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {review.images.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                        onClick={() => setActiveImage({ url: resolveReviewImageSrc(image.url), alt: "Review attachment" })}
                      className="relative h-24 w-full overflow-hidden border border-zinc-200 bg-zinc-50"
                    >
                      <img
                        src={resolveReviewImageSrc(image.url)}
                        alt="Review attachment"
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.src = "/window.svg";
                        }}
                      />
                    </button>
                  ))}
                </div>
              ) : null}

              {review.brandReply ? (
                <div className="mt-4 border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">Brand reply</p>
                  <p className="mt-2 text-sm text-zinc-700">{review.brandReply.content}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.12em] text-zinc-500">{review.brandReply.user.fullName}</p>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleHelpful(review.id, true)}
                  disabled={busyKey === `helpful:${review.id}:true`}
                  className="h-9 border border-zinc-300 px-3 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                >
                  Helpful ({review._count?.helpfulnessVotes || 0})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setReportByReview((current) => ({
                      ...current,
                      [review.id]: {
                        open: !reportDraft.open,
                        reason: reportDraft.reason,
                        description: reportDraft.description,
                      },
                    }))
                  }
                  className="h-9 border border-black bg-black px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white"
                >
                  Report
                </button>
              </div>

              {reportDraft.open ? (
                <form className="mt-4 space-y-2 border-t border-zinc-200 pt-4" onSubmit={(event) => void handleReport(event, review.id)}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      className="h-10 border border-zinc-300 px-3 text-sm"
                      value={reportDraft.reason}
                      onChange={(event) =>
                        setReportByReview((current) => ({
                          ...current,
                          [review.id]: {
                            ...reportDraft,
                            reason: event.target.value as ReviewReportReason,
                          },
                        }))
                      }
                    >
                      {reportReasons.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                    <input
                      className="h-10 border border-zinc-300 px-3 text-sm"
                      placeholder="Optional description"
                      value={reportDraft.description}
                      onChange={(event) =>
                        setReportByReview((current) => ({
                          ...current,
                          [review.id]: {
                            ...reportDraft,
                            description: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busyKey === `report:${review.id}`}
                    className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                  >
                    {busyKey === `report:${review.id}` ? "Reporting..." : "Submit Report"}
                  </button>
                </form>
              ) : null}
            </article>
          );
        })}
      </div>

      {canLoadMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void handleLoadMore()}
            disabled={loadingMore}
            className="h-10 border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load More Reviews"}
          </button>
        </div>
      ) : null}

      {activeImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" role="dialog" aria-modal="true" onClick={() => setActiveImage(null)}>
          <div className="relative max-h-[90vh] w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setActiveImage(null)} className="absolute right-2 top-2 z-10 border border-white/40 bg-black/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white">
              Close
            </button>
            <img src={activeImage.url} alt={activeImage.alt} className="max-h-[90vh] w-full object-contain" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
