"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createReview, deleteReview, getMyReviews, getUserOrders, updateReview, uploadReviewImages } from "@/lib/api";
import { useFormSubmission } from "@/hooks/use-form-submission";
import { resolveMediaUrl } from "@/lib/media-url";
import { useToastStore } from "@/stores/toast-store";
import type { ProductReview, UserOrder } from "@/types/marketplace";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(new Date(value));
}

function getDeliveredOrderItemIds(order: UserOrder) {
  return new Set(
    order.subOrders
      .filter((subOrder) => subOrder.status === "DELIVERED")
      .flatMap((subOrder) => subOrder.items.map((item) => item.id)),
  );
}

export default function AccountReviewsClient() {
  const searchParams = useSearchParams();
  const selectedReviewId = searchParams.get("reviewId") || "";
  const editReviewId = searchParams.get("editReviewId") || "";
  const formOpen = searchParams.get("formOpen") === "1";
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [orderItemId, setOrderItemId] = useState("");
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [selectedImageUrls, setSelectedImageUrls] = useState<string[]>([]);
  const pushToast = useToastStore((state) => state.pushToast);
  const reviewSubmission = useFormSubmission();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [items, userOrders] = await Promise.all([getMyReviews(50, 0), getUserOrders()]);
      setReviews(items);
      setOrders(userOrders);

      const reviewedOrderItemIds = new Set(items.map((review) => review.orderItemId));
      const eligibleOrderItems = userOrders
        .flatMap((order) => {
          const deliveredIds = getDeliveredOrderItemIds(order);
          return order.items
            .filter((item) => deliveredIds.has(item.id))
            .map((item) => ({ orderId: order.id, ...item }));
        })
        .filter((item) => !reviewedOrderItemIds.has(item.id));

      const preferredOrderItemId = searchParams.get("orderItemId") || "";
      const preferredExists = preferredOrderItemId && eligibleOrderItems.some((item) => item.id === preferredOrderItemId);
      const currentSelectionExists = eligibleOrderItems.some((item) => item.id === orderItemId);

      if (eligibleOrderItems.length && (!orderItemId || !currentSelectionExists)) {
        setOrderItemId(preferredExists ? preferredOrderItemId : eligibleOrderItems[0].id);
      }

      if (!eligibleOrderItems.length) {
        setOrderItemId("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [searchParams]);

  useEffect(() => {
    if (!formOpen) return;
    if (typeof window === "undefined") return;
    document.getElementById("write-review-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [formOpen]);

  const handleDelete = async (reviewId: string) => {
    setDeletingId(reviewId);
    try {
      await deleteReview(reviewId);
      setReviews((current) => current.filter((item) => item.id !== reviewId));
      pushToast("Review removed", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Failed to remove review", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const eligibleOrderItems = useMemo(
    () =>
      orders
        .flatMap((order) => {
          const deliveredIds = getDeliveredOrderItemIds(order);
          return order.items
            .filter((item) => deliveredIds.has(item.id))
            .map((item) => ({
              id: item.id,
              product: item.product,
              orderId: order.id,
            }));
        })
        .filter((item) => !reviews.some((review) => review.orderItemId === item.id)),
    [orders, reviews],
  );

  const editableReview = useMemo(() => {
    if (!editReviewId) return null;
    const matched = reviews.find((review) => review.id === editReviewId);
    if (!matched) return null;
    const withinEditWindow = Date.now() - new Date(matched.createdAt).getTime() <= 10 * 60 * 1000;
    return withinEditWindow ? matched : null;
  }, [editReviewId, reviews]);

  useEffect(() => {
    if (!editableReview) return;
    setOrderItemId(editableReview.orderItemId);
    setRating(editableReview.rating);
    setContent(editableReview.content);
    setSelectedImageUrls(editableReview.images.map((image) => image.url));
  }, [editableReview]);

  const handleImageSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosenFiles = Array.from(event.target.files || []);
    event.currentTarget.value = "";

    if (!chosenFiles.length) {
      return;
    }

    const remaining = 6 - selectedImageUrls.length;
    if (remaining <= 0) {
      pushToast("You can upload up to 6 images", "error");
      return;
    }

    const filesToUpload = chosenFiles.slice(0, remaining);
    setUploadingImages(true);
    try {
      const uploadedUrls = await uploadReviewImages(filesToUpload);
      setSelectedImageUrls((current) => [...current, ...uploadedUrls]);
      if (chosenFiles.length > remaining) {
        pushToast(`Only ${remaining} image(s) were added (max 6).`, "error");
      }
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Unable to upload images", "error");
    } finally {
      setUploadingImages(false);
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!orderItemId) {
      pushToast("Select a delivered order item to review", "error");
      return;
    }

    if (!content.trim()) {
      pushToast("Review content is required", "error");
      return;
    }

    if (content.trim().length < 10) {
      pushToast("Review content must be at least 10 characters", "error");
      return;
    }

    if (rating < 1 || rating > 5) {
      pushToast("Please choose a star rating", "error");
      return;
    }

    const result = await reviewSubmission.execute(async () => {
      if (editableReview) {
        await updateReview(editableReview.id, {
          rating,
          content: content.trim(),
          imageUrls: selectedImageUrls,
        });
        pushToast("Review updated", "success");
      } else {
        await createReview({
          orderItemId,
          rating,
          content: content.trim(),
          imageUrls: selectedImageUrls,
        });
        pushToast("Review submitted", "success");
      }
      setContent("");
      setSelectedImageUrls([]);
      setRating(0);
      await load();
    }, {
      errorMessage: "Unable to submit review",
      onError: (_error, message) => {
        pushToast(message, "error");
      },
    });

    if (!result.ok) {
      return;
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Account</p>
        <h1 className="font-heading text-5xl uppercase">My Reviews</h1>
        <p className="text-sm text-zinc-600">Track your product feedback, ratings, and brand replies in one place.</p>
      </header>

      {loading ? <p className="text-sm text-zinc-700">Loading reviews...</p> : null}
      {error ? <p className="text-sm text-amber-700">{error}</p> : null}

      {!loading && !error ? (
        <section className="space-y-4 border border-zinc-300 p-5">
          <h2 className="font-heading text-3xl uppercase">{editableReview ? "Edit Review" : "Write a Review"}</h2>
          {editableReview || eligibleOrderItems.length ? (
            <form id="write-review-form" className="space-y-3" onSubmit={(event) => void handleCreate(event)}>
              <select className="h-10 w-full border border-zinc-300 px-3 text-sm" value={orderItemId} onChange={(event) => setOrderItemId(event.target.value)} disabled={Boolean(editableReview)}>
                {editableReview ? (
                  <option value={editableReview.orderItemId}>{editableReview.product?.name || "Product"} - Order {editableReview.orderItem?.order?.id || ""}</option>
                ) : null}
                {eligibleOrderItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.product.name} - Order {item.orderId}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className="text-4xl leading-none"
                    aria-label={`Rate ${value} stars`}
                  >
                    <span className={value <= rating ? "text-black" : "text-zinc-300"}>{value <= rating ? "★" : "☆"}</span>
                  </button>
                ))}
              </div>
              <textarea className="min-h-28 w-full border border-zinc-300 p-3 text-sm" placeholder="Share your experience" value={content} onChange={(event) => setContent(event.target.value)} />
              <div className="space-y-2 border border-zinc-300 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Review images (max 6)</p>
                  <label className="inline-flex cursor-pointer items-center border border-zinc-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-700">
                    {uploadingImages ? "Uploading..." : "Choose Images"}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => void handleImageSelection(event)} disabled={uploadingImages || selectedImageUrls.length >= 6} />
                  </label>
                </div>
                {selectedImageUrls.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {selectedImageUrls.map((url) => (
                      <div key={url} className="relative">
                        <img src={resolveMediaUrl(url)} alt="Selected review upload" className="h-24 w-full border border-zinc-200 object-cover" />
                        <button
                          type="button"
                          onClick={() => setSelectedImageUrls((current) => current.filter((item) => item !== url))}
                          className="absolute right-1 top-1 border border-black bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">No images selected.</p>
                )}
              </div>
              <button type="submit" disabled={reviewSubmission.isSubmitting} className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50">
                {reviewSubmission.isSubmitting ? "Submitting..." : editableReview ? "Update Review" : "Submit Review"}
              </button>
            </form>
          ) : (
            <p className="text-sm text-zinc-600">You need a delivered order item before you can submit a review.</p>
          )}
        </section>
      ) : null}

      {!loading && !error ? (
        reviews.length ? (
          <section className="space-y-4">
            {reviews.map((review) => (
              <article key={review.id} className={`border p-4 ${selectedReviewId === review.id ? "border-black bg-zinc-50" : "border-zinc-300"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                    {formatDate(review.createdAt)} • {review.rating}/5 • {review.status}
                  </p>
                  <div className="flex items-center gap-2">
                    {Date.now() - new Date(review.createdAt).getTime() <= 10 * 60 * 1000 ? (
                      <Link
                        href={`/account/reviews?editReviewId=${encodeURIComponent(review.id)}`}
                        className="border border-black bg-black px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
                      >
                        Edit Review
                      </Link>
                    ) : null}
                    <Link
                      href={`/product/${review.product?.slug || ""}`}
                      className="border border-zinc-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                    >
                      Open Product
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDelete(review.id)}
                      disabled={deletingId === review.id}
                      className="border border-red-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-red-700 disabled:opacity-50"
                    >
                      {deletingId === review.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </div>

                <p className="mt-2 text-base font-semibold text-zinc-900">{review.product?.name || "Product"}</p>

                <p className="mt-2 text-sm leading-7 text-zinc-700">{review.content}</p>

                {review.images.length ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {review.images.map((image) => (
                      <img key={image.id} src={resolveMediaUrl(image.url)} alt="Review upload" className="h-24 w-full border border-zinc-200 object-cover" />
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
              </article>
            ))}
          </section>
        ) : (
          <section className="border border-zinc-300 p-6">
            <p className="text-sm text-zinc-700">You have not posted any reviews yet.</p>
          </section>
        )
      ) : null}
    </main>
  );
}
