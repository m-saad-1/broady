"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyAccount } from "@/lib/auth-client";
import { useAuthStore } from "@/stores/auth-store";

function VerifyAccountContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  const resolveNextRoute = (role?: string) => {
    if (role === "SUPER_ADMIN" || role === "ADMIN") return "/admin";
    if (role === "BRAND_ADMIN" || role === "BRAND_STAFF" || role === "BRAND") return "/brand/dashboard";
    return "/catalog";
  };

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link. No token provided.");
      return;
    }

    verifyAccount(token)
      .then((user) => {
        setUser(user);
        setStatus("success");
        setMessage("Account verified successfully! Redirecting...");
        setTimeout(() => {
          router.push(resolveNextRoute(user.role));
          router.refresh();
        }, 2000);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Verification failed.");
      });
  }, [token, router, setUser]);

  return (
    <main className="mx-auto w-full max-w-lg space-y-8 px-4 py-20 text-center">
      <h1 className="font-heading text-4xl uppercase">Account Verification</h1>
      {status === "loading" && (
        <p className="text-zinc-600">Verifying your account, please wait...</p>
      )}
      {status === "success" && (
        <p className="text-emerald-600 font-medium">{message}</p>
      )}
      {status === "error" && (
        <div className="space-y-4">
          <p className="text-amber-700 font-medium">{message}</p>
          <button 
            onClick={() => router.push("/login")}
            className="h-11 border border-black bg-black px-6 text-xs font-semibold uppercase tracking-[0.15em] text-white"
          >
            Go to Login
          </button>
        </div>
      )}
    </main>
  );
}

export default function VerifyAccountPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <VerifyAccountContent />
    </Suspense>
  );
}
