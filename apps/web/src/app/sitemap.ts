import type { MetadataRoute } from "next";
import { getBrands } from "@/lib/api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://broady.pk";
  const brands = await getBrands();
  const brandRoutes = brands.map((brand) => `/brand/${brand.slug}`);

  return [
    "",
    "/brands",
    "/catalog",
    "/offers",
    "/wishlist",
    "/cart",
    "/checkout",
    "/login",
    ...brandRoutes,
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: path === "" ? 1 : 0.8,
  }));
}
