"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginUser } from "@/lib/auth-client";
import { useAuthStore } from "@/stores/auth-store";

function resolveNextRoute(role?: string) {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return "/admin";
  if (role === "BRAND_ADMIN" || role === "BRAND_STAFF" || role === "BRAND") return "/brand/dashboard";
  return "/catalog";
}

export default function BrandLoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");

    try {
      setIsLoading(true);
      const user = await loginUser({ email, password });
      setUser(user);
      router.push(resolveNextRoute(user.role));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to login.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-6xl items-center px-4 py-10 lg:px-10">
      <div className="grid w-full gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="border border-zinc-300 bg-[linear-gradient(135deg,rgba(17,24,39,0.98),rgba(38,38,38,0.94))] p-8 text-white shadow-[0_30px_90px_-40px_rgba(0,0,0,0.65)]">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-300">Brand Portal</p>
          <h1 className="mt-4 max-w-lg font-heading text-6xl uppercase leading-none">Secure Brand Access</h1>
          <p className="mt-5 max-w-xl text-sm leading-6 text-zinc-300">
            Use this tenant-specific entry point for brand owners and staff. Every request from here resolves against one brand account, one brand dashboard, and one isolated order set.
          </p>
          <div className="mt-8 grid gap-3 text-xs uppercase tracking-[0.12em] text-zinc-200 sm:grid-cols-2">
            <div className="border border-white/10 bg-white/5 p-4">Role-aware access control</div>
            <div className="border border-white/10 bg-white/5 p-4">Brand-scoped order visibility</div>
            <div className="border border-white/10 bg-white/5 p-4">Manual onboarding workflow</div>
            <div className="border border-white/10 bg-white/5 p-4">Dedicated dashboard routes</div>
          </div>
        </section>

        <section className="border border-zinc-300 bg-white p-8">
          <header className="space-y-3 border-b border-zinc-300 pb-5">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Brand Login</p>
            <h2 className="font-heading text-5xl uppercase">Sign in</h2>
            <p className="text-sm text-zinc-600">Brand-admin and brand-staff accounts enter the isolated brand workspace after login.</p>
          </header>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <input name="email" type="email" placeholder="Brand email" className="h-11 w-full border border-zinc-300 px-3" required />
            <input name="password" type="password" placeholder="Password" className="h-11 w-full border border-zinc-300 px-3" required />
            <button type="submit" disabled={isLoading} className="h-11 w-full border border-black bg-black px-6 text-xs font-semibold uppercase tracking-[0.15em] text-white disabled:opacity-50">
              {isLoading ? "Signing in" : "Enter brand portal"}
            </button>
          </form>

          {message ? <p className="mt-4 text-sm text-zinc-600">{message}</p> : null}

          <p className="mt-6 text-sm text-zinc-600">
            Not a brand user? <Link href="/login" className="underline">Use the customer login</Link>
          </p>
        </section>
      </div>
    </main>
  );
}