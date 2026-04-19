import { getBrandSession } from "../../_lib/brand-session";
import { BrandReviewsClient } from "./reviews-client";

export const metadata = {
  title: "Brand Reviews | BROADY",
  description: "Review customer feedback and publish public replies for your brand.",
};

export default async function BrandReviewsPage() {
  await getBrandSession();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Brand Operations</p>
        <h1 className="font-heading text-5xl uppercase">Reviews</h1>
        <p className="max-w-3xl text-sm text-zinc-600">Monitor customer sentiment, inspect reports, and respond publicly from your brand workspace.</p>
      </header>

      <BrandReviewsClient />
    </main>
  );
}
