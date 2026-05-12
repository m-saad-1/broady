"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { completePasswordReset } from "@/lib/auth-client";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token. Please request a new link.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await completePasswordReset({ token, password });
      setMessage(response);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed. The link may have expired.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token && error) {
    return (
      <div className="space-y-6 border border-zinc-300 p-8 text-center">
        <p className="text-red-600 uppercase tracking-wider text-xs">{error}</p>
        <Link
          href="/forgot-password"
          className="inline-block border border-black bg-black px-8 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-all hover:bg-white hover:text-black"
        >
          Request New Link
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      {message ? (
        <div className="space-y-6 border border-zinc-300 p-8 text-center bg-zinc-50">
          <p className="text-zinc-900 font-medium">{message}</p>
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Redirecting to login...</p>
          <Link
            href="/login"
            className="inline-block border border-black bg-black px-8 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-all hover:bg-white hover:text-black"
          >
            Login Now
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 border border-zinc-300 p-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="new-password" title="New Password" id="new-password-label" className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-12 w-full border border-zinc-300 bg-white px-4 text-sm transition-colors focus:border-black focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirm-password" title="Confirm Password" id="confirm-password-label" className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-12 w-full border border-zinc-300 bg-white px-4 text-sm transition-colors focus:border-black focus:outline-none"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-600 uppercase tracking-wider">{error}</p>}

          <button
            id="reset-password-submit"
            type="submit"
            disabled={isLoading || !token}
            className="w-full border border-black bg-black py-4 text-xs font-bold uppercase tracking-[0.2em] text-white transition-all hover:bg-white hover:text-black disabled:opacity-50"
          >
            {isLoading ? "Resetting..." : "Update Password"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-lg space-y-8 px-4 py-20">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <h1 className="font-heading text-5xl uppercase text-zinc-900">Reset Password</h1>
        <p className="text-sm text-zinc-600 uppercase tracking-wider">
          Create a new secure password for your account.
        </p>
      </header>
      
      <Suspense fallback={<div className="p-8 border border-zinc-300 text-center uppercase tracking-widest text-xs">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
