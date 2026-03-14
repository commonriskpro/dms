import { notFound } from "next/navigation";
import { cache } from "react";
import type { PublishedSiteContext } from "@dms/contracts";

const DEALER_API_URL = process.env.DEALER_API_URL ?? "http://localhost:3000";

type ResolveResponse = { context: PublishedSiteContext };

/**
 * Resolves a published site context by hostname from the dealer API.
 * Cached per request via React cache() for deduplication.
 */
export const resolveSite = cache(async (hostname: string): Promise<PublishedSiteContext> => {
  const url = `${DEALER_API_URL}/api/public/websites/resolve?hostname=${encodeURIComponent(hostname)}`;
  const res = await fetch(url, {
    next: { revalidate: 60 }, // Cache for 60s in production
  });

  if (res.status === 404) {
    notFound();
  }

  if (!res.ok) {
    throw new Error(`Failed to resolve site for hostname "${hostname}": ${res.status}`);
  }

  const data = (await res.json()) as ResolveResponse;
  return data.context;
});
