"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { registerUser, loginWithGoogleIdToken } from "@/lib/auth-client";
import { useGoogleAuthConfig } from "@/providers/google-auth-provider";
import { useAuthStore } from "@/stores/auth-store";

type RegisterFormValues = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type RegisterFormErrors = Partial<Record<keyof RegisterFormValues, string>>;

function validateRegisterForm(values: RegisterFormValues): RegisterFormErrors {
  const errors: RegisterFormErrors = {};

  if (values.fullName.trim().length < 3) {
    errors.fullName = "Please enter your full name (at least 3 characters).";
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(values.email.trim().toLowerCase())) {
    errors.email = "Please enter a valid email address.";
  }

  if (values.password.length < 8) {
    errors.password = "Password must be at least 8 characters long.";
  } else {
    if (!/[A-Z]/.test(values.password)) {
      errors.password = "Password must include at least one uppercase letter.";
    } else if (!/[a-z]/.test(values.password)) {
      errors.password = "Password must include at least one lowercase letter.";
    } else if (!/\d/.test(values.password)) {
      errors.password = "Password must include at least one number.";
    }
  }

  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

export default function RegisterPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [formValues, setFormValues] = useState<RegisterFormValues>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [formErrors, setFormErrors] = useState<RegisterFormErrors>({});
  const { isConfigured } = useGoogleAuthConfig();
  const setUser = useAuthStore((state) => state.setUser);

  const resolveNextRoute = (role?: string) => {
    if (role === "SUPER_ADMIN" || role === "ADMIN") return "/admin";
    if (role === "BRAND_ADMIN" || role === "BRAND_STAFF" || role === "BRAND") return "/brand/dashboard";
    return "/catalog";
  };

  const validationSummary = useMemo(() => {
    if (!Object.keys(formErrors).length) return "";
    return "Please review the highlighted fields and try again.";
  }, [formErrors]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    const normalizedValues: RegisterFormValues = {
      fullName: formValues.fullName.trim(),
      email: formValues.email.trim().toLowerCase(),
      password: formValues.password,
      confirmPassword: formValues.confirmPassword,
    };

    const nextErrors = validateRegisterForm(normalizedValues);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("Please fix the form errors before continuing.");
      return;
    }

    try {
      setIsLoading(true);
      await registerUser({
        fullName: normalizedValues.fullName,
        email: normalizedValues.email,
        password: normalizedValues.password,
      });
      router.push(`/verify-reminder?email=${encodeURIComponent(normalizedValues.email)}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to register.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-lg space-y-8 px-4 py-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <h1 className="font-heading text-5xl uppercase">Create Account</h1>
      </header>
      <form className="space-y-4 border border-zinc-300 p-6" onSubmit={onSubmit}>
        {validationSummary ? <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{validationSummary}</p> : null}

        <div className="space-y-1">
          <input
            name="fullName"
            type="text"
            placeholder="Full name"
            value={formValues.fullName}
            onChange={(event) => setFormValues((current) => ({ ...current, fullName: event.target.value }))}
            className={`h-11 w-full border px-3 ${formErrors.fullName ? "border-amber-500" : "border-zinc-300"}`}
            required
            aria-invalid={Boolean(formErrors.fullName)}
          />
          {formErrors.fullName ? <p className="text-xs text-amber-700">{formErrors.fullName}</p> : null}
        </div>

        <div className="space-y-1">
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={formValues.email}
            onChange={(event) => setFormValues((current) => ({ ...current, email: event.target.value }))}
            className={`h-11 w-full border px-3 ${formErrors.email ? "border-amber-500" : "border-zinc-300"}`}
            required
            aria-invalid={Boolean(formErrors.email)}
          />
          {formErrors.email ? <p className="text-xs text-amber-700">{formErrors.email}</p> : null}
        </div>

        <div className="space-y-1">
          <input
            name="password"
            type="password"
            placeholder="Password"
            value={formValues.password}
            onChange={(event) => setFormValues((current) => ({ ...current, password: event.target.value }))}
            className={`h-11 w-full border px-3 ${formErrors.password ? "border-amber-500" : "border-zinc-300"}`}
            required
            aria-invalid={Boolean(formErrors.password)}
          />
          {formErrors.password ? <p className="text-xs text-amber-700">{formErrors.password}</p> : null}
        </div>

        <div className="space-y-1">
          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirm password"
            value={formValues.confirmPassword}
            onChange={(event) => setFormValues((current) => ({ ...current, confirmPassword: event.target.value }))}
            className={`h-11 w-full border px-3 ${formErrors.confirmPassword ? "border-amber-500" : "border-zinc-300"}`}
            required
            aria-invalid={Boolean(formErrors.confirmPassword)}
          />
          {formErrors.confirmPassword ? <p className="text-xs text-amber-700">{formErrors.confirmPassword}</p> : null}
        </div>

        <button type="submit" disabled={isLoading} className="h-11 border border-black bg-black px-6 text-xs font-semibold uppercase tracking-[0.15em] text-white disabled:opacity-50">
          {isLoading ? "Registering" : "Register"}
        </button>
        <div className="border-t border-zinc-300 pt-4">
          <p className="mb-3 text-[11px] uppercase tracking-[0.12em] text-zinc-500">Or continue with</p>
          <div className="flex justify-center">
            {isConfigured ? (
              <GoogleLogin
                onSuccess={async (credentialResponse) => {
                  try {
                    setIsLoading(true);
                    setMessage("");
                    if (!credentialResponse.credential) {
                      setMessage("Failed to get Google credentials");
                      return;
                    }
                    const user = await loginWithGoogleIdToken(credentialResponse.credential);
                    setUser(user);
                    router.push(resolveNextRoute(user.role));
                    router.refresh();
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Google sign-up failed");
                  } finally {
                    setIsLoading(false);
                  }
                }}
                onError={() => {
                  setMessage("Google sign-up failed. Please try again.");
                }}
                width="300"
                text="signup_with"
              />
            ) : (
              <p className="text-sm text-zinc-600">Google sign-up is not configured</p>
            )}
          </div>
        </div>
      </form>
      {message && <p className="text-sm text-zinc-600">{message}</p>}
      <p className="text-sm text-zinc-600">
        Already a member? <Link href="/login" className="underline">Sign in</Link>
      </p>
    </main>
  );
}
