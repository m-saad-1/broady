"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginUser } from "@/lib/auth-client";
import { useAuthStore } from "@/stores/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [googlePlaceholderMessage, setGooglePlaceholderMessage] = useState("");
  const setUser = useAuthStore((state) => state.setUser);

  const resolveNextRoute = (role?: string) => {
    if (role === "SUPER_ADMIN" || role === "ADMIN") return "/admin";
    if (role === "BRAND_ADMIN" || role === "BRAND_STAFF" || role === "BRAND") return "/brand/dashboard";
    return "/catalog";
  };

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
      const nextUrl = resolveNextRoute(user.role);
      router.push(nextUrl);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to login.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-lg space-y-8 px-4 py-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <h1 className="font-heading text-5xl uppercase">Login</h1>
      </header>
      <form className="space-y-4 border border-zinc-300 p-6" onSubmit={onSubmit}>
        <input name="email" type="email" placeholder="Email" className="h-11 w-full border border-zinc-300 px-3" required />
        <input name="password" type="password" placeholder="Password" className="h-11 w-full border border-zinc-300 px-3" required />
        <button type="submit" disabled={isLoading} className="h-11 border border-black bg-black px-6 text-xs font-semibold uppercase tracking-[0.15em] text-white disabled:opacity-50">
          {isLoading ? "Signing in" : "Sign in"}
        </button>
        <div className="border-t border-zinc-300 pt-4">
          <p className="mb-3 text-[11px] uppercase tracking-[0.12em] text-zinc-500">Or continue with</p>
          <button
            type="button"
            onClick={() => setGooglePlaceholderMessage("Google sign-in will be available soon.")}
            className="inline-flex h-11 w-full items-center justify-center gap-2 border border-zinc-300 bg-white px-3 text-xs font-semibold uppercase tracking-[0.12em]"
            aria-label="Continue with Google"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" focusable="false">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.8-4.1 2.8-7 0-.7-.1-1.5-.2-2.2H12z" />
              <path fill="#34A853" d="M12 22c2.5 0 4.6-.8 6.1-2.3L15 17.3c-.9.6-1.9.9-3 .9-2.3 0-4.2-1.5-4.9-3.6H3.9v2.3C5.4 19.9 8.4 22 12 22z" />
              <path fill="#4A90E2" d="M7.1 14.6c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V8.3H3.9A9.9 9.9 0 0 0 3 12c0 1.6.4 3.1 1 4.5l3.1-1.9z" />
              <path fill="#FBBC05" d="M12 6.7c1.3 0 2.5.5 3.4 1.3l2.6-2.6C16.6 3.9 14.5 3 12 3 8.4 3 5.4 5.1 3.9 8.3l3.2 2.4c.7-2.1 2.6-3.7 4.9-3.7z" />
            </svg>
            Continue with Google
          </button>
          {googlePlaceholderMessage ? <p className="mt-2 text-xs text-zinc-600">{googlePlaceholderMessage}</p> : null}
        </div>
      </form>
      {message && <p className="text-sm text-zinc-600">{message}</p>}
      <p className="text-sm text-zinc-600">
        New here? <Link href="/register" className="underline">Create account</Link>
      </p>
    </main>
  );
}
