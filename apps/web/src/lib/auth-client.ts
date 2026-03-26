import type { User } from "@/types/marketplace";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      credentials: "include",
    });

    if (!response.ok) return null;
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

  const json = (await response.json()) as { message?: string; user?: User };
  if (!response.ok) {
    throw new Error(json.message || "Login failed");
  }
  return json.user!;
}

export async function registerUser(payload: { fullName: string; email: string; password: string }) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = (await response.json()) as { message?: string; user?: User };
  if (!response.ok) {
    throw new Error(json.message || "Registration failed");
  }
  return json.user!;
}

export async function logoutUser() {
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

  const json = (await response.json()) as { message?: string; user?: User };
  if (!response.ok) {
    throw new Error(json.message || "Google login failed");
  }
  return json.user!;
}
