import Link from "next/link";
import Image from "next/image";
import type { PublicVehicleSummary } from "@dms/contracts";
import { getPhotoSrc } from "@/lib/media";

type Props = {
  vehicle: PublicVehicleSummary;
  primaryColor?: string;
};

function formatPrice(cents: string | null): string | null {
  if (!cents) return null;
  const n = parseInt(cents, 10);
  if (isNaN(n)) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    n / 100
  );
}

export function VehicleCard({ vehicle, primaryColor = "#1a56db" }: Props) {
  const title = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
  const price = formatPrice(vehicle.price);

  return (
    <Link
      href={`/vehicle/${vehicle.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        {vehicle.primaryPhotoUrl ? (
          <Image
            src={getPhotoSrc(vehicle.primaryPhotoUrl)}
            alt={title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h10l2-2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 7h2l2 4v4h-4V7z" />
            </svg>
          </div>
        )}
        {vehicle.isFeatured && (
          <span
            className="absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            Featured
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
            {vehicle.customHeadline ?? title}
          </h3>
          {vehicle.mileage != null && (
            <p className="text-sm text-gray-500 mt-0.5">
              {vehicle.mileage.toLocaleString()} mi
              {vehicle.exteriorColor && ` · ${vehicle.exteriorColor}`}
            </p>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between">
          {price ? (
            <span className="text-lg font-bold text-gray-900">{price}</span>
          ) : (
            <span className="text-sm font-medium text-gray-500">Call for price</span>
          )}
          <span
            className="rounded px-2.5 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            View Details
          </span>
        </div>
      </div>
    </Link>
  );
}
