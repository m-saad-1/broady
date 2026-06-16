"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getBrandReturnRequests } from "@/lib/api";
import {
  formatOperatorReturnStatus,
  formatReturnReasonLabel,
  getDisplayReturnStatus,
  getReturnRequestItems,
  getReturnRequestType,
} from "@/lib/return-workflow";
import type { ReturnRequestRecord } from "@/types/marketplace";

const filters = ["PENDING", "ACTIVE", "FINALIZED"] as const;

function formatDate(value?: string | null) {
  if (!value) return "Pending";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Pending";
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(parsed);
}

function itemLabel(request: ReturnRequestRecord) {
  const items = getReturnRequestItems(request);
  if (!items.length) return "No product";
  if (items.length === 1) {
    const item = items[0];
    return `${item.product?.name || "Product"} (${item.product?.id || item.id})`;
  }
  return `${items.length} selected products`;
}

export default function BrandReturnInboxPage() {
  const [requests, setRequests] = useState<ReturnRequestRecord[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]>("PENDING");

  useEffect(() => {
    getBrandReturnRequests().then(setRequests).catch(() => setRequests([]));
  }, []);

  const filtered = useMemo(() => {
    return requests.filter((request) => {
      const displayStatus = getDisplayReturnStatus(request);
      if (filter === "PENDING") return ["REQUESTED", "BRAND_REVIEWING", "NEED_MORE_EVIDENCE"].includes(displayStatus || "");
      if (filter === "ACTIVE") {
        return !["ADMIN_REJECTED", "COMPLETED", "EXCHANGE_COMPLETED", "REFUND_COMPLETED"].includes(displayStatus || "");
      }
      return ["ADMIN_REJECTED", "COMPLETED", "EXCHANGE_COMPLETED", "REFUND_COMPLETED"].includes(displayStatus || "");
    });
  }, [filter, requests]);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Brand Operations</p>
        <h1 className="font-heading text-5xl uppercase">Return / Exchange Requests</h1>
        <p className="max-w-3xl text-sm text-zinc-600">
          Keep this queue lightweight here, then open each request detail to complete the full workflow.
        </p>
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`h-10 border px-4 text-xs font-semibold uppercase tracking-[0.12em] ${
                filter === item ? "border-black bg-black text-white" : "border-zinc-300"
              }`}
            >
              {item === "PENDING" ? "Pending" : item === "ACTIVE" ? "Active" : "Finalized"}
            </button>
          ))}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {!filtered.length ? (
          <p className="border border-zinc-300 p-5 text-sm text-zinc-700">No requests in this view.</p>
        ) : (
          filtered.map((request) => {
            const requestType = getReturnRequestType(request);
            const displayStatus = getDisplayReturnStatus(request);
            const items = getReturnRequestItems(request);
            const leadItem = items[0];

            return (
              <article key={request.id} className="space-y-4 border border-zinc-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Request ID</p>
                    <p className="text-sm font-semibold">{request.id}</p>
                    <p className="text-sm text-zinc-600">{formatOperatorReturnStatus(displayStatus, requestType)}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                    requestType === "EXCHANGE"
                      ? "border-amber-300 bg-amber-100 text-amber-800"
                      : "border-sky-300 bg-sky-100 text-sky-800"
                  }`}>
                    {requestType}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Order / Product</p>
                    <p className="text-sm font-semibold">{request.orderId}</p>
                    <p className="text-sm text-zinc-600">{itemLabel(request)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Basic Details</p>
                    <p className="text-sm text-zinc-700">{formatReturnReasonLabel(request.reasonCode, request.reasonText)}</p>
                    <p className="text-sm text-zinc-600">Submitted {formatDate(request.createdAt)}</p>
                    {leadItem ? <p className="text-xs text-zinc-500">{leadItem.selectedColor || "No color"} / {leadItem.selectedSize || "No size"}</p> : null}
                  </div>
                </div>

                {(request.adminDecision || request.adminDecisionNote || request.adminRejectedReason) ? (
                  <div className="grid gap-2 border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                    <p>
                      <span className="font-semibold">Admin decision:</span>{" "}
                      {request.adminDecision === "APPROVED"
                        ? "Overruled Brand Rejection (Customer Approved)"
                        : request.adminDecision === "REJECTED"
                          ? "Confirmed Brand Rejection (Customer Rejected)"
                          : "Reviewed"}
                    </p>
                    <p><span className="font-semibold">Admin reason:</span> {request.adminRejectedReason || request.adminDecisionNote || "No reason added"}</p>
                  </div>
                ) : null}

                <div className="flex justify-end">
                  <Link href={`/brand/operations/returns/${request.id}`} className="inline-flex h-9 items-center border border-black bg-black px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                    Open Details
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
