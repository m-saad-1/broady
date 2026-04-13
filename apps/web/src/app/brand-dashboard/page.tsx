import { redirect } from "next/navigation";

export const metadata = {
  title: "Brand Dashboard | BROADY",
  description: "Manage your brand orders, status updates, products, and earnings in BROADY.",
};

export default async function BrandDashboardPage() {
  redirect("/brand/dashboard");
}
