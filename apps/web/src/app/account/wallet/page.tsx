"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getUserWallet } from "@/lib/api";
import { formatPkr } from "@/lib/utils";
import type { UserWallet } from "@/types/marketplace";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AccountWalletPage() {
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWallet = useCallback(async () => {
    try {
      const data = await getUserWallet();
      setWallet(data);
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load wallet.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWallet();
    const onFocus = () => void loadWallet();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const interval = window.setInterval(() => void loadWallet(), 15000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.clearInterval(interval);
    };
  }, [loadWallet]);

  if (loading) {
    return <main className="space-y-6"><div className="h-36 animate-pulse border border-zinc-200 bg-zinc-50" /></main>;
  }

  if (error || !wallet) {
    return (
      <main className="space-y-6">
        <section className="border border-red-200 bg-red-50 p-6 text-sm text-red-800">{error || "Wallet unavailable."}</section>
      </main>
    );
  }

  return (
    <main className="space-y-8">
      <header className="space-y-3 border-b border-zinc-300 pb-4">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Account Wallet</p>
        <h1 className="font-heading text-4xl uppercase">Wallet</h1>
        <p className="text-sm text-zinc-600">Demo refunds from cancellations and returns are credited here so you can verify the full payment loop.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Available Balance</p>
          <p className="mt-3 text-3xl font-semibold">{formatPkr(wallet.availableBalancePkr)}</p>
        </div>
        <div className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Total Credits</p>
          <p className="mt-3 text-2xl font-semibold">{formatPkr(wallet.totalCreditedPkr)}</p>
        </div>
        <div className="border border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Total Debits</p>
          <p className="mt-3 text-2xl font-semibold">{formatPkr(wallet.totalDebitedPkr)}</p>
        </div>
      </section>

      <section className="space-y-4 border border-zinc-300 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-3xl uppercase">Recent Transactions</h2>
          <Link href="/account/orders" className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600 hover:text-black">
            View Orders
          </Link>
        </div>

        {!wallet.transactions.length ? (
          <p className="text-sm text-zinc-600">No wallet activity yet. Refunds will show up here after admin completion.</p>
        ) : (
          <div className="space-y-3">
            {wallet.transactions.map((transaction) => (
              <article key={transaction.id} className="grid gap-3 border-b border-zinc-200 pb-3 md:grid-cols-[1fr_auto] md:items-center">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">
                    {transaction.type === "CREDIT" ? "Wallet credit" : "Wallet debit"} | {transaction.sourceType}
                  </p>
                  <p className="text-sm text-zinc-600">{transaction.note || "Wallet adjustment"}</p>
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                    {formatDateTime(transaction.createdAt)}
                    {transaction.order ? ` | Order ${transaction.order.id}` : ""}
                    {transaction.refundRequest ? ` | Refund ${transaction.refundRequest.id}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${transaction.type === "CREDIT" ? "text-emerald-700" : "text-red-700"}`}>
                    {transaction.type === "CREDIT" ? "+" : "-"}{formatPkr(transaction.amountPkr)}
                  </p>
                  <p className="text-xs text-zinc-500">Balance: {formatPkr(transaction.balanceAfterPkr)}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
