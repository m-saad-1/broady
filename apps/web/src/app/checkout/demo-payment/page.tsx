"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ApiRequestError, getPaymentSession, submitDemoPaymentResult } from "@/lib/api";
import { formatPkr } from "@/lib/utils";
import type { PaymentSessionRecord } from "@/types/marketplace";

const RESULT_OPTIONS: Array<{ value: "SUCCESS" | "FAILED" | "CANCELLED" | "TIMEOUT"; label: string; description: string }> = [
  { value: "SUCCESS", label: "Simulate Success", description: "Marks payment complete and confirms all pending vendor groups." },
  { value: "FAILED", label: "Simulate Failure", description: "Marks payment failed and keeps vendor groups pending for retry." },
  { value: "CANCELLED", label: "Simulate Cancelled", description: "Cancels this attempt without confirming the order." },
  { value: "TIMEOUT", label: "Simulate Timeout", description: "Expires this attempt and keeps the order pending until the retry window ends." },
];

function formatDateTime(value?: string | null) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function DemoPaymentPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("sessionId") || "";
  const [session, setSession] = useState<PaymentSessionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyResult, setBusyResult] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      setMessage("Payment session is missing from the URL.");
      return;
    }

    getPaymentSession(sessionId)
      .then((nextSession) => setSession(nextSession))
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "Unable to load the payment session.");
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  const order = session?.order;
  const hasExpired = useMemo(() => {
    if (!session?.expiresAt) return false;
    return new Date(session.expiresAt).getTime() <= Date.now() || session.status === "EXPIRED";
  }, [session]);

  const handleResult = async (result: "SUCCESS" | "FAILED" | "CANCELLED" | "TIMEOUT") => {
    if (!session || !order) return;

    setBusyResult(result);
    setMessage("");
    try {
      await submitDemoPaymentResult(order.id, {
        sessionId: session.id,
        result,
        paymentMethod: session.paymentMethod,
      });
      const refreshed = await getPaymentSession(session.id);
      setSession(refreshed);
      setMessage(result === "SUCCESS" ? "Payment verified. Your order is now confirmed." : `Demo gateway returned ${result.toLowerCase()}.`);
      if (result === "SUCCESS") {
        router.refresh();
      }
    } catch (error: unknown) {
      if (error instanceof ApiRequestError) {
        setMessage(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Unable to process the demo payment result.");
      }
    } finally {
      setBusyResult(null);
    }
  };

  if (loading) {
    return <main className="mx-auto w-full max-w-4xl px-4 py-10 lg:px-10"><div className="h-40 animate-pulse border border-zinc-200 bg-zinc-50" /></main>;
  }

  if (!session || !order) {
    return (
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10 lg:px-10">
        <section className="border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          <p>{message || "This payment session could not be found."}</p>
        </section>
        <Link href="/account/orders" className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
          Back to Orders
        </Link>
      </main>
    );
  }

  const paymentFinalized = session.status === "COMPLETED";
  const sessionLocked = paymentFinalized || ["FAILED", "CANCELLED", "TIMEOUT", "EXPIRED"].includes(session.status);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Demo Gateway</p>
        <h1 className="font-heading text-5xl uppercase">Demo Payment</h1>
        <p className="text-sm text-zinc-600">This page simulates a signed payment callback and webhook. The frontend does not mark the order paid directly.</p>
      </header>

      <section className="grid gap-4 border border-zinc-300 p-5 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Session</p>
          <p className="text-sm text-zinc-700">Session ID: {session.id}</p>
          <p className="text-sm text-zinc-700">Attempt: {session.attemptNumber}</p>
          <p className="text-sm text-zinc-700">Method: {session.paymentMethod}</p>
          <p className="text-sm text-zinc-700">Status: {session.status}</p>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Order</p>
          <p className="text-sm text-zinc-700">Order ID: {order.id}</p>
          <p className="text-sm text-zinc-700">Amount: {formatPkr(order.totalPkr)}</p>
          <p className="text-sm text-zinc-700">Retry window ends: {formatDateTime(session.retryExpiresAt || session.expiresAt)}</p>
          <p className="text-sm text-zinc-700">Current payment status: {order.paymentStatus}</p>
        </div>
      </section>

      <section className="space-y-4 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Select Test Result</h2>
        {hasExpired ? (
          <p className="border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">This payment session has expired. Create a new retry attempt from your order page if the retry window is still open.</p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          {RESULT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={Boolean(busyResult) || hasExpired || sessionLocked}
              onClick={() => void handleResult(option.value)}
              className="space-y-2 border border-zinc-300 p-4 text-left transition hover:border-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em]">{busyResult === option.value ? "Processing..." : option.label}</p>
              <p className="text-sm text-zinc-600">{option.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4 border border-zinc-300 p-5">
        <h2 className="font-heading text-3xl uppercase">Items</h2>
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between border-b border-zinc-200 pb-3 text-sm">
              <div>
                <p className="font-semibold">{item.product.name}</p>
                <p className="text-zinc-600">Qty {item.quantity}{item.brand?.name ? ` | ${item.brand.name}` : ""}</p>
              </div>
              <p className="font-semibold">{formatPkr(item.unitPricePkr * item.quantity)}</p>
            </div>
          ))}
        </div>
      </section>

      {message ? <p className="border border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-700">{message}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Link href={`/account/orders?orderId=${encodeURIComponent(order.id)}`} className="inline-flex h-10 items-center border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
          View Order
        </Link>
        <Link href="/account/wallet" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-800">
          Open Wallet
        </Link>
      </div>
    </main>
  );
}

export default function DemoPaymentPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-4xl px-4 py-10 lg:px-10"><div className="h-40 animate-pulse border border-zinc-200 bg-zinc-50" /></main>}>
      <DemoPaymentPageContent />
    </Suspense>
  );
}
