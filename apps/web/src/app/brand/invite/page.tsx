"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { completeBrandInvite } from "@/lib/auth-client";
import { useAuthStore } from "@/stores/auth-store";

function BrandInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const setUser = useAuthStore((state) => state.setUser);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (!token) {
      setMessage("Missing invite token.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") || "");

    try {
      setIsLoading(true);
      const user = await completeBrandInvite({ token, password });
      setUser(user);
      router.push("/brand/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to activate invite.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-3xl items-center px-4 py-10">
      <section className="w-full border border-zinc-300 bg-white p-8">
        <header className="space-y-3 border-b border-zinc-300 pb-5">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Brand Invitation</p>
          <h1 className="font-heading text-5xl uppercase">Set Your Password</h1>
          <p className="text-sm text-zinc-600">This secure invite activates your brand account on Broady.</p>
        </header>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <input name="password" type="password" placeholder="Create password" className="h-11 w-full border border-zinc-300 px-3" required minLength={8} />
          <button type="submit" disabled={isLoading} className="h-11 w-full border border-black bg-black px-6 text-xs font-semibold uppercase tracking-[0.15em] text-white disabled:opacity-50">
            {isLoading ? "Activating" : "Activate brand account"}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm text-zinc-600">{message}</p> : null}

        <p className="mt-6 text-sm text-zinc-600">
          Need a new link? Contact Broady admin.
        </p>
        <p className="mt-2 text-sm text-zinc-600">
          Return to <Link href="/brand/login" className="underline">brand login</Link>
        </p>
      </section>
    </main>
  );
}

export default function BrandInvitePage() {
  return (
    <Suspense fallback={<main className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-3xl items-center px-4 py-10"><p className="text-sm text-zinc-600">Loading invite...</p></main>}>
      <BrandInviteContent />
    </Suspense>
  );
}