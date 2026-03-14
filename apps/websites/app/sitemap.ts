import type { MetadataRoute } from "next";
import { getRequestHostname } from "@/lib/hostname";
import { resolveSite } from "@/lib/site-resolver";

const DEALER_API_URL = process.env.DEALER_API_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const hostname = await getRequestHostname();
    const site = await resolveSite(hostname);
    const baseUrl = `https://${hostname}`;

    const staticRoutes: MetadataRoute.Sitemap = [
      { url: baseUrl, changeFrequency: "weekly", priority: 1.0 },
      { url: `${baseUrl}/inventory`, changeFrequency: "daily", priority: 0.9 },
      { url: `${baseUrl}/contact`, changeFrequency: "monthly", priority: 0.6 },
    ];

    // Fetch published vehicle slugs
    const res = await fetch(
      `${DEALER_API_URL}/api/public/websites/inventory?hostname=${encodeURIComponent(hostname)}&limit=100`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) return staticRoutes;

    const { data } = (await res.json()) as { data: Array<{ slug: string }> };
    const vehicleRoutes: MetadataRoute.Sitemap = data.map((v) => ({
      url: `${baseUrl}/vehicle/${v.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    return [...staticRoutes, ...vehicleRoutes];
  } catch {
    return [];
  }
}
