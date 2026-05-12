"use client";

import Link from "next/link";
import { useState } from "react";
import { requestPasswordReset } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await requestPasswordReset({ email });
      setMessage(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-lg space-y-8 px-4 py-20">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <h1 className="font-heading text-5xl uppercase">Forgot Password</h1>
        <p className="text-sm text-zinc-600 uppercase tracking-wider">
          Enter your email to receive a password reset link.
        </p>
      </header>

      {message ? (
        <div className="space-y-6 border border-zinc-300 p-8 text-center">
          <p className="text-zinc-600">{message}</p>
          <Link
            href="/login"
            className="inline-block border border-black bg-black px-8 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-all hover:bg-white hover:text-black"
          >
            Back to Login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 border border-zinc-300 p-8">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="YOUR@EMAIL.COM"
              required
              className="h-12 w-full border border-zinc-300 bg-white px-4 text-sm transition-colors focus:border-black focus:outline-none"
            />
          </div>

          {error && <p className="text-xs text-red-600 uppercase tracking-wider">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full border border-black bg-black py-4 text-xs font-bold uppercase tracking-[0.2em] text-white transition-all hover:bg-white hover:text-black disabled:opacity-50"
          >
            {isLoading ? "Sending Link..." : "Send Reset Link"}
          </button>

          <div className="text-center pt-2">
            <Link href="/login" className="text-[11px] uppercase tracking-widest text-zinc-500 underline underline-offset-4 hover:text-black">
              Return to Login
            </Link>
          </div>
        </form>
      )}
    </main>
  );
}
