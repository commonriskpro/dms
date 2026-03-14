import Link from "next/link";
import type { PublishSnapshot } from "@dms/contracts";

type Props = {
  snapshot: PublishSnapshot;
};

export function SiteHeader({ snapshot }: Props) {
  const { dealership, theme } = snapshot;
  const primaryColor = theme?.primaryColor ?? "var(--ws-primary)";
  const headerBg = theme?.headerBgColor ?? "var(--ws-header-bg)";

  return (
    <header
      className="sticky top-0 z-50 border-b border-gray-100 shadow-sm"
      style={{ backgroundColor: headerBg }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          {theme?.logoUrl ? (
            <img src={theme.logoUrl} alt={dealership.name} className="h-10 w-auto object-contain" />
          ) : (
            <span className="text-xl font-bold" style={{ color: primaryColor }}>
              {dealership.name}
            </span>
          )}
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          <Link href="/inventory" className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
            Inventory
          </Link>
          <Link href="/contact" className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
            Contact
          </Link>
          {dealership.phone && (
            <a
              href={`tel:${dealership.phone}`}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: primaryColor }}
            >
              {dealership.phone}
            </a>
          )}
        </nav>

        {/* Mobile: phone CTA only */}
        {dealership.phone && (
          <a
            href={`tel:${dealership.phone}`}
            className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-semibold text-white sm:hidden"
            style={{ backgroundColor: primaryColor }}
          >
            Call
          </a>
        )}
      </div>
    </header>
  );
}
