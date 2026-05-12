"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchCurrentUser } from "@/lib/auth-client";
import { useAuthStore } from "@/stores/auth-store";
import { OrderTrackerClient } from "./order-tracker-client";

export default function AccountOverviewPage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
  }, [setUser]);

  if (loading) {
    return <main className="space-y-8 animate-pulse"><div className="h-32 bg-zinc-100 w-full" /></main>;
  }

  if (!user) {
    return (
      <main className="space-y-8">
        <section className="border border-zinc-300 p-6">
          <p className="text-sm text-zinc-700">Unable to load your account session. Please sign in again.</p>
          <Link href="/login" className="mt-4 inline-flex border border-black bg-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">
            Go to Login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-8">
      <header className="space-y-3">
        <h1 className="font-heading text-4xl uppercase">Hello, {user.fullName.split(' ')[0]}</h1>
        <p className="text-sm text-zinc-600">Welcome back to your Broady dashboard.</p>
      </header>

      {/* Quick Stats & Actions */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/account/orders" className="border border-zinc-300 p-4 hover:border-black transition-colors flex flex-col justify-between group">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 group-hover:text-black">Track Orders</p>
          <p className="mt-4 text-2xl font-light">→</p>
        </Link>
        <Link href="/account/wishlist" className="border border-zinc-300 p-4 hover:border-black transition-colors flex flex-col justify-between group">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 group-hover:text-black">Saved Items</p>
          <p className="mt-4 text-2xl font-light">→</p>
        </Link>
        <Link href="/catalog" className="border border-zinc-300 p-4 hover:border-black transition-colors flex flex-col justify-between group">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 group-hover:text-black">Continue Shopping</p>
          <p className="mt-4 text-2xl font-light">→</p>
        </Link>
        <Link href="/account/support" className="border border-zinc-300 p-4 hover:border-black transition-colors flex flex-col justify-between group bg-zinc-50">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 group-hover:text-black">Contact Support</p>
          <p className="mt-4 text-2xl font-light">→</p>
        </Link>
      </section>

      {/* Recent Orders Overview */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-300 pb-3">
          <h2 className="font-heading text-2xl uppercase">Recent Orders</h2>
          <Link href="/account/orders" className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600 hover:text-black">
            View All
          </Link>
        </div>
        <OrderTrackerClient compact />
      </section>
    </main>
  );
}
