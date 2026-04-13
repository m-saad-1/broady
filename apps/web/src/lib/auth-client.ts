import type { User } from "@/types/marketplace";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const AUTH_TOKEN_KEY = "broady_access_token";

function persistAuthToken(token?: string) {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    return;
  }
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function getStoredAuthToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function clearStoredAuthToken() {
  persistAuthToken(undefined);
}

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearStoredAuthToken();
      }
      return null;
    }
    const json = (await response.json()) as { user: User };
    return json.user;
  } catch {
    return null;
  }
}

export async function loginUser(payload: { email: string; password: string }) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = (await response.json()) as { message?: string; user?: User; token?: string };
  if (!response.ok) {
    throw new Error(json.message || "Login failed");
  }
  persistAuthToken(json.token);
  return json.user!;
}

export async function registerUser(payload: { fullName: string; email: string; password: string }) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = (await response.json()) as { message?: string; user?: User; token?: string };
  if (!response.ok) {
    throw new Error(json.message || "Registration failed");
  }
  persistAuthToken(json.token);
  return json.user!;
}

export async function logoutUser() {
  clearStoredAuthToken();
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function loginWithGoogleIdToken(idToken: string) {
  const response = await fetch(`${API_BASE}/auth/google`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  const json = (await response.json()) as { message?: string; user?: User; token?: string };
  if (!response.ok) {
    throw new Error(json.message || "Google login failed");
  }
  persistAuthToken(json.token);
  return json.user!;
}

export async function completeBrandInvite(payload: { token: string; password: string }) {
  const response = await fetch(`${API_BASE}/auth/brand-invite/complete`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = (await response.json()) as { message?: string; user?: User; token?: string };
  if (!response.ok) {
    throw new Error(json.message || "Brand invite activation failed");
  }

  persistAuthToken(json.token);
  return json.user!;
}
