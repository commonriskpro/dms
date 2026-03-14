import type { MetadataRoute } from "next";
import { getRequestHostname } from "@/lib/hostname";

export default async function robots(): Promise<MetadataRoute.Robots> {
  try {
    const hostname = await getRequestHostname();
    return {
      rules: { userAgent: "*", allow: "/" },
      sitemap: `https://${hostname}/sitemap.xml`,
    };
  } catch {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
}
