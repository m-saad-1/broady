"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loginUser, loginWithGoogleIdToken } from "@/lib/auth-client";
import { useAuthStore } from "@/stores/auth-store";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const mountPoint = document.getElementById("google-signin-btn");
      if (!window.google || !mountPoint) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          const credential = response.credential;
          if (!credential) {
            setMessage("Google login failed. Missing credential.");
            return;
          }

          try {
            setIsLoading(true);
            const user = await loginWithGoogleIdToken(credential);
            setUser(user);
            const nextUrl = user.role === "ADMIN" ? "/admin" : "/catalog";
            router.push(nextUrl);
            router.refresh();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Google login failed.");
          } finally {
            setIsLoading(false);
          }
        },
      });

      mountPoint.innerHTML = "";
      window.google.accounts.id.renderButton(mountPoint, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 280,
      });
    };

    document.body.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [router, setUser]);

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
      const nextUrl = user.role === "ADMIN" ? "/admin" : "/catalog";
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
          <div id="google-signin-btn" />
        </div>
      </form>
      {message && <p className="text-sm text-zinc-600">{message}</p>}
      <p className="text-sm text-zinc-600">
        New here? <Link href="/register" className="underline">Create account</Link>
      </p>
    </main>
  );
}
