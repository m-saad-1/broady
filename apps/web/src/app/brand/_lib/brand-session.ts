import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@/types/marketplace";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export async function getBrandSession() {
  const token = (await cookies()).get("broady_token")?.value;
  if (!token) redirect("/brand/login");

  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: { Cookie: `broady_token=${token}` },
    cache: "no-store",
  });

  if (!response.ok) redirect("/brand/login");

  const payload = (await response.json()) as { user?: User };
  const user = payload.user;
  if (!user) redirect("/brand/login");

  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
    redirect("/admin");
  }

  if (user.role !== "BRAND_ADMIN" && user.role !== "BRAND_STAFF" && user.role !== "BRAND") {
    redirect("/account?forbidden=brand-dashboard");
  }

  return { token, user };
}