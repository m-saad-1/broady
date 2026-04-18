import { Suspense } from "react";
import AccountReviewsClient from "./reviews-client";

export default function AccountReviewsPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-5xl px-4 py-10 text-sm text-zinc-700 lg:px-10">Loading reviews...</main>}>
      <AccountReviewsClient />
    </Suspense>
  );
}
