import { type Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRequestHostname } from "@/lib/hostname";
import { getPhotoSrc } from "@/lib/media";
import { resolveSite } from "@/lib/site-resolver";
import { SiteHeader } from "@/templates/premium-default/SiteHeader";
import { SiteFooter } from "@/templates/premium-default/SiteFooter";
import { LeadForm } from "@/templates/premium-default/LeadForm";
import type { PublicVehicleDetail } from "@dms/contracts";

const DEALER_API_URL = process.env.DEALER_API_URL ?? "http://localhost:3000";

async function fetchVehicle(hostname: string, slug: string): Promise<PublicVehicleDetail | null> {
  const params = new URLSearchParams({ hostname });
  const res = await fetch(
    `${DEALER_API_URL}/api/public/websites/vehicle/${encodeURIComponent(slug)}?${params}`,
    { next: { revalidate: 30 } }
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = (await res.json()) as { vehicle: PublicVehicleDetail };
  return data.vehicle;
}

function formatPrice(cents: string | null): string | null {
  if (!cents) return null;
  const n = parseInt(cents, 10);
  if (isNaN(n)) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n / 100);
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const hostname = await getRequestHostname();
  const site = await resolveSite(hostname);
  const vehicle = await fetchVehicle(hostname, slug);
  if (!vehicle) return { title: "Vehicle Not Found" };

  const title = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
  return {
    title: `${title} | ${site.snapshot.dealership.name}`,
    description:
      vehicle.customDescription ??
      `${title} available at ${site.snapshot.dealership.name}. ${vehicle.mileage ? `${vehicle.mileage.toLocaleString()} miles.` : ""}`,
  };
}

export default async function VehicleDetailPage({ params }: Props) {
  const { slug } = await params;
  const hostname = await getRequestHostname();
  const site = await resolveSite(hostname);
  const vehicle = await fetchVehicle(hostname, slug);

  if (!vehicle) notFound();

  const { snapshot } = site;
  const primaryColor = snapshot.theme?.primaryColor ?? "#1a56db";
  const title = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
  const price = formatPrice(vehicle.price);

  const photos: string[] = vehicle.photos ?? [];

  return (
    <>
      <SiteHeader snapshot={snapshot} />

      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <nav className="mb-6 text-sm text-gray-500">
            <Link href="/" className="hover:text-gray-700">Home</Link>
            {" / "}
            <Link href="/inventory" className="hover:text-gray-700">Inventory</Link>
            {" / "}
            <span className="text-gray-900">{title}</span>
          </nav>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Photos + details */}
            <div className="lg:col-span-2">
              {/* Primary photo */}
              <div className="relative overflow-hidden rounded-xl bg-gray-100 aspect-[16/9]">
                {photos[0] ? (
                  <Image
                    src={getPhotoSrc(photos[0])}
                    alt={title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 66vw"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-300">
                    <span className="text-5xl">🚗</span>
                  </div>
                )}
              </div>

              {/* Thumbnail strip */}
              {photos.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {photos.slice(1, 8).map((fileObjectId, i) => (
                    <div key={fileObjectId ?? i} className="relative h-16 w-24 flex-none overflow-hidden rounded-lg bg-gray-100">
                      {fileObjectId && (
                        <Image
                          src={getPhotoSrc(fileObjectId)}
                          alt={`${title} photo ${i + 2}`}
                          fill
                          className="object-cover"
                          sizes="96px"
                          unoptimized
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Specs */}
              <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Vehicle Details</h2>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  {[
                    { label: "Year", value: vehicle.year },
                    { label: "Make", value: vehicle.make },
                    { label: "Model", value: vehicle.model },
                    { label: "Trim", value: vehicle.trim },
                    { label: "Mileage", value: vehicle.mileage != null ? `${vehicle.mileage.toLocaleString()} mi` : null },
                    { label: "Exterior Color", value: vehicle.exteriorColor },
                    { label: "Interior Color", value: vehicle.interiorColor },
                    { label: "Condition", value: vehicle.condition },
                    { label: "Body Style", value: vehicle.bodyStyle },
                    { label: "Engine", value: vehicle.engine },
                    { label: "Transmission", value: vehicle.transmission },
                    { label: "Drivetrain", value: vehicle.drivetrain },
                    { label: "VIN", value: vehicle.vinPartial ? `****${vehicle.vinPartial}` : null },
                  ]
                    .filter((row) => row.value != null && row.value !== "")
                    .map((row) => (
                      <div key={row.label}>
                        <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{row.label}</dt>
                        <dd className="mt-0.5 text-sm font-medium text-gray-900">{row.value}</dd>
                      </div>
                    ))}
                </dl>

                {vehicle.customDescription && (
                  <div className="mt-6 border-t border-gray-100 pt-4">
                    <p className="text-sm leading-relaxed text-gray-700">{vehicle.customDescription}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar: price + lead form */}
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h1 className="text-2xl font-bold text-gray-900">{vehicle.customHeadline ?? title}</h1>
                {price ? (
                  <p className="mt-2 text-3xl font-bold" style={{ color: primaryColor }}>{price}</p>
                ) : (
                  <p className="mt-2 text-lg text-gray-500">Call for price</p>
                )}
                <p className="mt-1 text-sm text-gray-500">{vehicle.stockNumber && `Stock #${vehicle.stockNumber}`}</p>

                <div className="mt-4 space-y-2">
                  <a
                    href={`tel:${snapshot.dealership.phone}`}
                    className="block w-full rounded-lg py-2.5 text-center font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {snapshot.dealership.phone ?? "Call Us"}
                  </a>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <LeadForm
                  formType="CHECK_AVAILABILITY"
                  vehicleSlug={slug}
                  vehicleTitle={title}
                  primaryColor={primaryColor}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter snapshot={snapshot} />
    </>
  );
}
