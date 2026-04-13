import { OrderTrackerClient } from "../order-tracker-client";

export const metadata = {
  title: "My Orders | BROADY",
  description: "View and track all of your BROADY orders in one place.",
};

export default function AccountOrdersPage() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Account Orders</p>
        <h1 className="font-heading text-5xl uppercase">Order History</h1>
        <p className="max-w-3xl text-sm text-zinc-600">Review every order, track its current status, and open the full detail view whenever you need more context.</p>
      </header>

      <OrderTrackerClient />
    </main>
  );
}
