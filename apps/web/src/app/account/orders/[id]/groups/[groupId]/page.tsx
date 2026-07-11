import Link from "next/link";
import { getTrackingUrl } from "@broady/shared";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ProductImage } from "@/components/ui/product-image";
import { formatPkr } from "@/lib/utils";
import { getOrderStatusLabel, getOrderStatusTone } from "@/lib/order-status";
import { getCancelledOrderItemIds } from "@/lib/order-cancellation";
import { resolveMediaUrl } from "@/lib/media-url";
import {
  formatOperatorReturnStatus,
  getDisplayReturnStatus,
  getReturnRequestDetailPath,
  getReturnRequestItemIds,
  getReturnRequestType,
} from "@/lib/return-workflow";
import type { NotificationItem, ProductReview, UserOrder } from "@/types/marketplace";
import { NotificationsLoadMore } from "./notifications-load-more";
import { GroupActions } from "./group-actions";
import { CancelItemButton } from "./cancel-item-button";

type VendorGroupDetailPageProps = {
  params: Promise<{ id: string; groupId: string }>;
};

async function fetchOrder(orderId: string, token: string): Promise<UserOrder> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/orders/me/${orderId}`, {
    headers: { Cookie: `broady_token=${token}` },
    cache: "no-store",
  });

  if (response.status === 404) notFound();
  if (response.status === 401 || response.status === 403) redirect("/login?next=/account/orders");
  if (!response.ok) throw new Error("ORDER_FETCH_FAILED");

  const json = (await response.json()) as { data: UserOrder };
  return json.data;
}

async function fetchOrderNotifications(orderId: string, token: string): Promise<NotificationItem[]> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/users/notifications`, {
    headers: { Cookie: `broady_token=${token}` },
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    return [];
  }

  if (!response.ok) {
    return [];
  }

  const json = (await response.json()) as { data: NotificationItem[] };
  return json.data
    .filter((item) => item.order?.id === orderId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function fetchMyReviews(token: string): Promise<Record<string, { id: string; createdAt: string }>> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/reviews/me?limit=300&skip=0`, {
    headers: { Cookie: `broady_token=${token}` },
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403 || !response.ok) {
    return {};
  }

  const json = (await response.json()) as { data: ProductReview[] };
  return (json.data || []).reduce<Record<string, { id: string; createdAt: string }>>((accumulator, review) => {
    accumulator[review.orderItemId] = { id: review.id, createdAt: review.createdAt };
    return accumulator;
  }, {});
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function resolveProductImageSrc(imageUrl?: string | null) {
  return resolveMediaUrl(imageUrl);
}

function getDeliveredAt(statusLogs: UserOrder["subOrders"][number]["statusLogs"]) {
  const deliveredLog = [...statusLogs].reverse().find((log) => log.status === "DELIVERED");
  return deliveredLog ? new Date(deliveredLog.createdAt) : null;
}

const SHIPMENT_TIMELINE: Array<{ key: "CONFIRMED" | "PROCESSING" | "PACKED" | "READY_FOR_PICKUP" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED"; label: string }> = [
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "PROCESSING", label: "Processing" },
  { key: "PACKED", label: "Packed" },
  { key: "READY_FOR_PICKUP", label: "Ready for Pickup" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { key: "DELIVERED", label: "Delivered" },
];

function getLatestItemRequest(
  orderId: string,
  groupId: string,
  requests: NonNullable<UserOrder["subOrders"][number]["returnRequests"]> | undefined,
  itemIds: string[],
  itemId: string,
) {
  const matched = (requests || [])
    .filter((request) => getReturnRequestItemIds(request, itemIds).includes(itemId))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())[0];

  if (!matched) return null;

  const requestType = getReturnRequestType(matched);
  const displayStatus = getDisplayReturnStatus(matched);

  return {
    label: requestType === "EXCHANGE" ? "Exchange Requested for this Product" : "Return Requested for this Product",
    requestType,
    path: getReturnRequestDetailPath({
      role: "CUSTOMER",
      orderId,
      subOrderId: groupId,
      requestId: matched.id,
      requestType: matched.requestType,
      preferredResolution: matched.preferredResolution,
    }),
  };
}

export default async function VendorGroupDetailPage({ params }: VendorGroupDetailPageProps) {
  const token = (await cookies()).get("broady_token")?.value;
  if (!token) redirect("/login?next=/account/orders");

  const { id, groupId } = await params;
  const [order, notifications, myReviewsByOrderItemId] = await Promise.all([
    fetchOrder(id, token),
    fetchOrderNotifications(id, token),
    fetchMyReviews(token),
  ]);

  const group = order.subOrders.find((item) => item.id === groupId);
  if (!group) {
    redirect(`/account/orders?orderId=${encodeURIComponent(id)}`);
  }

  const groupNotifications = notifications.filter((item) => {
    const message = item.message?.toLowerCase() || "";
    const title = item.title?.toLowerCase() || "";
    const brandName = group.brand?.name?.toLowerCase() || "";
    return brandName ? message.includes(brandName) || title.includes(brandName) : true;
  });
  const canWriteReview = group.status === "DELIVERED";
  const canCancelGroup = false;
  const cancellationRequiresReview = ["PACKED", "READY_FOR_PICKUP"].includes(group.status);
  const deliveredAt = getDeliveredAt(group.statusLogs);
  const minReturnWindowDays = group.items
    .map((item) => item.product.shipping?.returnWindowDays)
    .filter((value): value is number => typeof value === "number" && value > 0)
    .sort((a, b) => a - b)[0] || 7;
  const returnWindowClosed = Boolean(deliveredAt && deliveredAt.getTime() + minReturnWindowDays * 24 * 60 * 60 * 1000 < Date.now());
  const canReturnGroup = group.status === "DELIVERED" && !returnWindowClosed && group.items.every((item) => item.product.shipping?.returnAvailable !== false);
  const canReorderGroup = ["DELIVERED", "RETURNED", "CANCELED"].includes(group.status);
  const canAddressCorrection = group.status === "ADDRESS_CORRECTION_REQUIRED";
  const canTrackRefund = ["CANCELED", "RETURNED", "SHIPMENT_RETURNED"].includes(group.status) || Boolean(group.refundProcessedAt);
  const canRetryPayment =
    order.paymentMethod !== "COD" &&
    order.paymentStatus !== "COMPLETED" &&
    order.paymentRetryEligible === true &&
    group.status === "PENDING";
  const cancelledItemIds = getCancelledOrderItemIds(group.statusLogs);
  const timelineStatuses = new Set(group.statusLogs.map((log) => log.status));
  const trackingUrl = group.trackingId && group.courierName ? getTrackingUrl(group.courierName, group.trackingId) : null;
  const groupItemIds = group.items.map((item) => item.id);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Order Detail</p>
        <h1 className="font-heading text-5xl uppercase">{group.brand?.name || "Brand"} Group</h1>
        <p className="text-sm text-zinc-700"><span className="font-semibold">Order ID:</span> {order.id}</p>
        <p className="text-sm text-zinc-700"><span className="font-semibold">Group ID:</span> {group.id}</p>
      </header>

      <section className="grid gap-4 border border-zinc-300 p-5 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Status</p>
          <p className={`mt-2 inline-flex border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${getOrderStatusTone(group.status)}`}>
            {getOrderStatusLabel(group.status)}
          </p>
          <p className="mt-2 text-sm text-zinc-600">Tracking ID: {group.trackingId || "Pending assignment"}</p>
          <p className="mt-2 text-sm text-zinc-600">Courier: {group.courierName || "Pending assignment"}</p>
          {group.estimatedDelivery ? <p className="mt-2 text-sm text-zinc-600">Estimated delivery: {formatDateTime(group.estimatedDelivery)}</p> : null}
          <p className="mt-2 text-sm text-zinc-600">Delivery attempts: {group.deliveryAttempts || 0}</p>
          {group.failureReason ? <p className="mt-2 text-sm text-orange-800">Failure reason: {group.failureReason}</p> : null}
          {group.nextAttemptDate ? <p className="mt-2 text-sm text-blue-800">Next attempt: {formatDateTime(group.nextAttemptDate)}</p> : null}
          {group.refundProcessedAt ? <p className="mt-2 text-sm text-emerald-800">Refund marked: {formatDateTime(group.refundProcessedAt)}</p> : null}
          {trackingUrl ? (
            <a
              href={trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex h-9 items-center border border-black bg-black px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
            >
              Track Shipment
            </a>
          ) : null}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Brand</p>
          <p className="mt-2 text-sm font-semibold">{group.brand?.name || "Brand"}</p>
          <p className="mt-2 text-sm text-zinc-600">Placed {formatDateTime(group.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Group Subtotal</p>
          <p className="mt-2 text-sm font-semibold">{formatPkr(group.subtotalPkr)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Order Metadata</p>
          <p className="mt-2 text-sm text-zinc-700">Payment: {order.paymentMethod} / {order.paymentStatus}</p>
          <p className="mt-2 text-sm text-zinc-700">Delivery: {order.deliveryAddress}</p>
        </div>
        <div className="md:col-span-2">
          <GroupActions
            orderId={order.id}
            subOrderId={group.id}
            brandName={group.brand?.name || "Brand"}
            items={group.items.map((item) => ({
              id: item.id,
              name: item.product.name,
              quantity: item.quantity,
              selectedColor: item.selectedColor || undefined,
              selectedSize: item.selectedSize || undefined,
              availableColors: item.product.colors || (item.product.color ? [item.product.color] : []),
              availableSizes: item.product.sizes || [],
            }))}
            canCancel={canCancelGroup}
            cancellationRequiresReview={cancellationRequiresReview}
            canReturn={canReturnGroup}
            canReorder={canReorderGroup}
            canAddressCorrection={canAddressCorrection}
            canRetryPayment={canRetryPayment}
            currentDeliveryAddress={order.deliveryAddress}
          />
          {["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERY_FAILED", "ADDRESS_CORRECTION_REQUIRED", "READY_FOR_REDELIVERY", "SHIPMENT_RETURNED"].includes(group.status) ? (
            <button type="button" disabled className="mt-3 inline-flex h-10 items-center justify-center border border-zinc-300 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Cancellation Unavailable
            </button>
          ) : null}
          {group.status === "DELIVERED" && returnWindowClosed ? (
            <button type="button" disabled className="mt-3 inline-flex h-10 items-center justify-center border border-zinc-300 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Return window closed
            </button>
          ) : null}
          {!canCancelGroup && !canReorderGroup && !canAddressCorrection && ["SHIPPED", "OUT_FOR_DELIVERY"].includes(group.status) ? (
            <p className="text-sm text-zinc-600">This item has already been shipped. You can request a return after delivery if eligible.</p>
          ) : null}
          {canTrackRefund ? (
            <Link
              href={`/account/orders/${order.id}/groups/${group.id}/refund`}
              className="mt-3 inline-flex h-10 items-center justify-center border border-zinc-300 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] hover:border-black hover:text-black"
            >
              Refund Tracking
            </Link>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Shipment Tracking</h2>
        <div className="space-y-2 border border-zinc-200 p-4">
          {SHIPMENT_TIMELINE.map((step) => {
            const done = timelineStatuses.has(step.key) || group.status === step.key;
            return (
              <p key={step.key} className={`text-sm ${done ? "text-zinc-900 font-semibold" : "text-zinc-500"}`}>
                {done ? "✔" : "○"} {step.label}
              </p>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Items</h2>
        <div className="space-y-3">
          {group.items.map((item) => {
            const isCancelled = group.status === "CANCELED" || cancelledItemIds.has(item.id);
            const itemRequest = getLatestItemRequest(order.id, group.id, group.returnRequests, groupItemIds, item.id);
            const cancelRequest = group.cancellationRequests?.find((req) => (!req.orderItemIds?.length || req.orderItemIds.includes(item.id)) && req.status !== "CANCELLED_BY_USER");
            return (
            <article key={item.id} className={`grid gap-3 border-b py-3 md:grid-cols-[72px_1fr_auto] md:items-center ${isCancelled ? "border-red-100 bg-red-50 px-2" : "border-zinc-200"}`}>
              <div className="relative h-14 w-14 overflow-hidden border border-zinc-200">
                <ProductImage
                  src={resolveProductImageSrc(item.product.imageUrl)}
                  alt={item.product.name || "Product image"}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </div>

              <div>
                <Link
                  href={`/product/${item.product.slug}`}
                  className="text-sm font-semibold uppercase tracking-[0.08em] underline decoration-zinc-400 underline-offset-2"
                >
                  {item.product.name}
                </Link>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-700">
                  <p className="font-semibold">Size: {item.selectedSize || "Not specified"}</p>
                  <p className="font-semibold">Color: {item.selectedColor || "Not specified"}</p>
                  <p className="font-semibold">Quantity: {item.quantity}</p>
                  <p className="font-semibold">Price: {formatPkr(item.unitPricePkr)}</p>
                  {isCancelled ? <p className="font-semibold uppercase tracking-[0.12em] text-red-700">Cancelled</p> : null}
                  {itemRequest ? (
                    <Link
                      href={itemRequest.path}
                      className={`inline-flex border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                        itemRequest.requestType === "EXCHANGE"
                          ? "border-amber-300 bg-amber-100 text-amber-800"
                          : "border-sky-300 bg-sky-100 text-sky-800"
                      }`}
                    >
                      {itemRequest.label}
                    </Link>
                  ) : null}
                  {cancelRequest ? (
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                        cancelRequest.status === "REJECTED" ? "text-red-600" : "text-amber-700"
                      }`}>
                        {cancelRequest.status === "REJECTED" ? "Cancellation Rejected" : "Cancellation Requested"}
                      </span>
                      <Link
                        href={`/account/orders/${order.id}/groups/${group.id}/cancellation`}
                        className="inline-flex border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] border-zinc-300 text-zinc-700 hover:border-black hover:text-black"
                      >
                        Track Cancellation
                      </Link>
                    </div>
                  ) : null}
                  {!isCancelled && !itemRequest && !cancelRequest && ["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "READY_FOR_PICKUP"].includes(group.status) ? (
                    <CancelItemButton
                      orderId={order.id}
                      subOrderId={group.id}
                      itemId={item.id}
                      brandName={group.brand?.name || "Brand"}
                      cancellationRequiresReview={cancellationRequiresReview}
                    />
                  ) : null}
                </div>
              </div>

              {canWriteReview && !isCancelled ? (
                myReviewsByOrderItemId[item.id] ? (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/account/reviews?reviewId=${encodeURIComponent(myReviewsByOrderItemId[item.id].id)}`}
                      className="inline-flex h-9 items-center border border-zinc-300 px-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    >
                      View Review
                    </Link>
                    <Link
                      href={`/account/reviews?editReviewId=${encodeURIComponent(myReviewsByOrderItemId[item.id].id)}`}
                      className="inline-flex h-9 items-center border border-black bg-black px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
                    >
                      Edit Review
                    </Link>
                  </div>
                ) : (
                  <Link
                    href={`/account/reviews?orderItemId=${encodeURIComponent(item.id)}&formOpen=1`}
                    className="inline-flex h-9 items-center border border-black bg-black px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
                  >
                    Write Review
                  </Link>
                )
              ) : isCancelled ? (
                <span className="inline-flex h-9 items-center justify-center border border-red-200 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-700">
                  Cancelled
                </span>
              ) : null}
            </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Status Timeline</h2>
        <div className="space-y-3">
          {group.statusLogs.map((log) => (
            <article key={log.id} className="border border-zinc-200 p-3 text-sm">
              <p className="font-semibold uppercase tracking-[0.08em]">{getOrderStatusLabel(log.status)}</p>
              <p className="text-zinc-600">
                {log.updatedBy}
                {log.note ? ` - ${log.note}` : ""}
              </p>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{formatDateTime(log.createdAt)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Related Notifications</h2>
        <NotificationsLoadMore items={groupNotifications} />
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/account/orders" className="inline-flex h-11 items-center justify-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
          Back to Orders
        </Link>
      </div>
    </main>
  );
}
