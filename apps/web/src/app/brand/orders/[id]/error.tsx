"use client";

import Link from "next/link";

export default function BrandOrderDetailError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-10 lg:px-10">
      <section className="space-y-3 border border-amber-300 bg-amber-50 p-5">
        <p className="text-xs uppercase tracking-[0.12em] text-amber-700">Brand Order Details</p>
        <h1 className="font-heading text-4xl uppercase">Something went wrong</h1>
        <p className="text-sm text-amber-900">We could not load this brand order right now.</p>
        <div className="flex gap-2">
          <button type="button" onClick={reset} className="h-10 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            Try again
          </button>
          <Link href="/brand/orders" className="inline-flex h-10 items-center border border-zinc-300 px-4 text-xs font-semibold uppercase tracking-[0.12em]">
            Back to orders
          </Link>
        </div>
      </section>
    </main>
  );
}
