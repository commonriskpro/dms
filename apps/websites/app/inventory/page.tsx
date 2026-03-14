import { type Metadata } from "next";
import { getRequestHostname } from "@/lib/hostname";
import { resolveSite } from "@/lib/site-resolver";
import { SiteHeader } from "@/templates/premium-default/SiteHeader";
import { SiteFooter } from "@/templates/premium-default/SiteFooter";
import { VehicleCard } from "@/templates/premium-default/VehicleCard";
import type { PublicVehicleSummary, PublicInventoryListResult } from "@dms/contracts";
import Link from "next/link";

const DEALER_API_URL = process.env.DEALER_API_URL ?? "http://localhost:3000";

async function fetchInventory(
  hostname: string,
  page: number,
  filters: { make?: string; model?: string; year?: number }
): Promise<PublicInventoryListResult> {
  const params = new URLSearchParams({ hostname, page: String(page), limit: "24" });
  if (filters.make) params.set("make", filters.make);
  if (filters.model) params.set("model", filters.model);
  if (filters.year) params.set("year", String(filters.year));

  const res = await fetch(`${DEALER_API_URL}/api/public/websites/inventory?${params}`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) return { data: [], meta: { total: 0, page: 1, limit: 24 } };
  return res.json() as Promise<PublicInventoryListResult>;
}

export async function generateMetadata(): Promise<Metadata> {
  const hostname = await getRequestHostname();
  const site = await resolveSite(hostname);
  return {
    title: `Inventory | ${site.snapshot.dealership.name}`,
    description: `Browse our full inventory at ${site.snapshot.dealership.name}.`,
  };
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InventoryPage({ searchParams }: Props) {
  const sp = await searchParams;
  const hostname = await getRequestHostname();
  const site = await resolveSite(hostname);
  const { snapshot } = site;
  const primaryColor = snapshot.theme?.primaryColor ?? "#1a56db";

  const page = parseInt(String(sp.page ?? "1"), 10);
  const make = typeof sp.make === "string" ? sp.make : undefined;
  const model = typeof sp.model === "string" ? sp.model : undefined;
  const year = sp.year ? parseInt(String(sp.year), 10) : undefined;

  const result = await fetchInventory(hostname, page, { make, model, year });

  const totalPages = Math.ceil(result.meta.total / result.meta.limit);

  return (
    <>
      <SiteHeader snapshot={snapshot} />

      <main className="min-h-screen bg-gray-50">
        <div className="border-b border-gray-200 bg-white py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-gray-900">Our Inventory</h1>
            <p className="mt-1 text-gray-500">
              {result.meta.total > 0
                ? `${result.meta.total} vehicles available`
                : "No vehicles match your search"}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {result.data.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-lg text-gray-500">No vehicles are currently available. Please check back soon.</p>
              <Link
                href="/contact"
                className="mt-4 inline-flex rounded-lg px-6 py-2.5 text-sm font-semibold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                Contact Us
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {result.data.map((v) => (
                  <VehicleCard key={v.slug} vehicle={v} primaryColor={primaryColor} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-2">
                  {page > 1 && (
                    <PageLink href={buildHref(sp, page - 1)} label="← Previous" primaryColor={primaryColor} />
                  )}
                  <span className="text-sm text-gray-500">
                    Page {page} of {totalPages}
                  </span>
                  {page < totalPages && (
                    <PageLink href={buildHref(sp, page + 1)} label="Next →" primaryColor={primaryColor} />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <SiteFooter snapshot={snapshot} />
    </>
  );
}

function buildHref(sp: Record<string, string | string[] | undefined>, page: number) {
  const params = new URLSearchParams();
  if (sp.make && typeof sp.make === "string") params.set("make", sp.make);
  if (sp.model && typeof sp.model === "string") params.set("model", sp.model);
  if (sp.year) params.set("year", String(sp.year));
  params.set("page", String(page));
  return `/inventory?${params}`;
}

function PageLink({ href, label, primaryColor }: { href: string; label: string; primaryColor: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      style={{ backgroundColor: primaryColor }}
    >
      {label}
    </Link>
  );
}
