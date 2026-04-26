import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ProductCreateFormPage } from "@/components/dashboard/product-create-form-page";

export const metadata = {
  title: "Add Product | Admin Panel | BROADY",
  description: "Create a new product in the admin panel from a dedicated page.",
};

export default async function AdminProductCreatePage() {
  const token = (await cookies()).get("broady_token")?.value;
  if (!token) redirect("/login?next=/admin/products/new");

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/auth/me`, {
    headers: { Cookie: `broady_token=${token}` },
    cache: "no-store",
  });

  if (!response.ok) redirect("/login?next=/admin/products/new");
  const session = (await response.json()) as { user?: { role?: string } };
  if (session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN") redirect("/account?forbidden=admin");

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 lg:px-10">
      <header className="space-y-3 border-b border-zinc-300 pb-5">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Admin Panel</p>
        <h1 className="font-heading text-5xl uppercase">Add Product</h1>
        <p className="max-w-3xl text-sm text-zinc-600">Use the dedicated product creation form to add catalog items without mixing creation with product browsing.</p>
      </header>

      <ProductCreateFormPage scope="admin" />
    </main>
  );
}
