import Link from "next/link";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { ReturnEvidenceUploadForm } from "@/components/returns/return-evidence-upload-form";
import { formatReturnReasonLabel, formatReturnStatus, getDisplayReturnStatus, getReturnRequestItems, getReturnStatusMessage, getWorkflowTimeline, isExchangeRequest } from "@/lib/return-workflow";
import { formatPkr } from "@/lib/utils";
import type { RefundRequestRecord, ReturnRequestRecord } from "@/types/marketplace";

type PageProps = { params: Promise<{ id: string; groupId: string; returnRequestId: string }> };

async function fetchJson<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}${path}`, {
    headers: { Cookie: `broady_token=${token}` },
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) redirect("/login?next=/account/orders");
  if (!response.ok) throw new Error("REQUEST_FAILED");
  const json = await response.json() as { data: T };
  return json.data;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Pending";
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function ReturnExchangeDetailPage({ params }: PageProps) {
  const token = (await cookies()).get("broady_token")?.value;
  if (!token) redirect("/login?next=/account/orders");
  const { id, groupId, returnRequestId } = await params;

  const [requests, refunds] = await Promise.all([
    fetchJson<ReturnRequestRecord[]>(`/orders/me/${id}/sub-orders/${groupId}/return-requests`, token),
    fetchJson<RefundRequestRecord[]>(`/orders/me/${id}/sub-orders/${groupId}/refund-requests`, token),
  ]);

  const request = requests.find((entry) => entry.id === returnRequestId) || requests[0];
  if (!request) notFound();
  const refund = refunds.find((entry) => entry.returnRequest?.id === request.id) || refunds[0];
  const isExchange = isExchangeRequest(request);
  const displayStatus = getDisplayReturnStatus(request);
  const requestText = `${request.reviewNote || request.brandRecommendationNote || ""}`.toLowerCase();
  const convertedToRefund = isExchange && (requestText.includes("converted to refund") || requestText.includes("out of stock"));
  const timeline = getWorkflowTimeline(request);
  const requestItems = getReturnRequestItems(request);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{isExchange ? "Exchange Detail" : "Return Detail"}</p>
        <h1 className="font-heading text-4xl uppercase">{isExchange ? "Exchange Request" : "Return Request"}</h1>
        <p className="text-sm text-zinc-600">A complete audit trail for your request, evidence, decision, and refund progress.</p>
      </header>

      {convertedToRefund ? (
        <section className="border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Your replacement item is out of stock. Your exchange has been converted to a refund.
          <div className="mt-3">
            <Link href={`/account/orders/${id}/groups/${groupId}/refund`} className="inline-flex h-10 items-center border border-amber-700 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-amber-900">
              Open Refund Tracking
            </Link>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 border border-zinc-300 p-5 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Request ID</p>
          <p className="mt-2 text-sm font-semibold">{request.id}</p>
          <p className="mt-2 text-sm text-zinc-600">Created {formatDateTime(request.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Current Status</p>
          <p className="mt-2 text-sm font-semibold">{formatReturnStatus(displayStatus)}</p>
          <p className="mt-2 text-sm text-zinc-600">{request.reviewNote || request.brandRecommendationNote || "Waiting for the next update."}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Resolution</p>
          <p className="mt-2 text-sm font-semibold">{request.preferredResolution || "REFUND"}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.12em] text-zinc-500">{isExchange ? "Replacement requested" : "Refund requested"}</p>
          <p className="mt-2 text-sm text-zinc-600">{request.pickupTracking ? `Pickup/return tracking: ${request.pickupTracking}` : "Tracking will appear once scheduled."}</p>
        </div>
      </section>

      <section className="grid gap-4 border border-zinc-300 p-5 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Item Details</p>
          <p className="text-sm text-zinc-700">{requestItems.map((item) => `${item.product?.name || "Product"} x${item.quantity}`).join(", ")}</p>
          <p className="text-sm text-zinc-700">Reason: {formatReturnReasonLabel(request.reasonCode, request.reasonText)}</p>
          <p className="text-sm text-zinc-700">Sub-order: {request.subOrderId}</p>
          <p className="text-sm text-zinc-700">Order: {request.orderId}</p>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Evidence</p>
          <p className="text-sm text-zinc-700">Customer images: {(request.evidenceImageUrls || []).length}</p>
          <p className="text-sm text-zinc-700">Brand evidence: {(request.damageEvidenceUrls || []).length}</p>
          {request.damageClaimNote ? <p className="text-sm text-zinc-700">Damage claim: {request.damageClaimNote}</p> : null}
          {request.brandRecommendation ? <p className="text-sm text-zinc-700">Brand decision: {request.brandRecommendation}</p> : null}
        </div>
      </section>

      <section className="space-y-3 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Timeline</h2>
        <div className="space-y-3">
          {timeline.map((status) => {
            const matchedLog = request.statusLogs?.find((entry) => entry.status === status);
            const isActive = request.status === status;
            return (
              <article key={status} className={`border p-3 text-sm ${isActive ? "border-black bg-zinc-50" : "border-zinc-200"}`}>
                <p className="font-semibold uppercase tracking-[0.08em]">{formatReturnStatus(status)}</p>
                <p className="text-zinc-600">{formatDateTime(matchedLog?.createdAt)}</p>
                {matchedLog?.note ? <p className="mt-1 text-zinc-700">{matchedLog.note}</p> : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="border border-zinc-300 p-5 text-sm text-zinc-700">
        {getReturnStatusMessage(request)}
      </section>

      {displayStatus === "NEED_MORE_EVIDENCE" ? (
        <ReturnEvidenceUploadForm orderId={id} subOrderId={groupId} returnRequestId={request.id} />
      ) : null}

      {displayStatus === "RETURN_ARRANGED" ? (
        <section className="border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
          Return tracking: {request.returnTrackingNumber || request.pickupTracking || "Brand will confirm the return instructions shortly."}
        </section>
      ) : null}

      {(displayStatus === "BRAND_REJECTED" || displayStatus === "ADMIN_REJECTED" || displayStatus === "RETURN_CONDITION_DISPUTED") ? (
        <section className="border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          Rejection reason: {request.adminRejectedReason || request.adminDecisionNote || request.reviewNote || request.brandRecommendationNote || "Your request was rejected after review."}
        </section>
      ) : null}

      {refund ? (
        <section className="space-y-3 border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
          <p className="font-semibold">Refund amount: {formatPkr(refund.adjustedAmountPkr || refund.amountPkr)}</p>
          <p>Method: {refund.method || "Pending"}</p>
          <p>Status: {refund.status}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href={`/account/orders/${id}/groups/${groupId}/refund`} className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
              Open Refund Tracking
            </Link>
            <Link href="/account/wallet" className="inline-flex h-10 items-center border border-emerald-700 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-900">
              Check Wallet
            </Link>
          </div>
        </section>
      ) : (
        <section className="border border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-700">
          No refund is linked yet. If this is an exchange flow, the refund or replacement status will appear here after review.
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href={`/account/orders/${id}/groups/${groupId}`} className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
          Back to Order
        </Link>
        <Link href="/account/support" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
          Contact Support
        </Link>
      </div>
    </main>
  );
}
