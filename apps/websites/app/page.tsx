import { type Metadata } from "next";
import Link from "next/link";
import { getRequestHostname } from "@/lib/hostname";
import { resolveSite } from "@/lib/site-resolver";
import { SiteHeader } from "@/templates/premium-default/SiteHeader";
import { SiteFooter } from "@/templates/premium-default/SiteFooter";

export async function generateMetadata(): Promise<Metadata> {
  const hostname = await getRequestHostname();
  const site = await resolveSite(hostname);
  return {
    title: `${site.snapshot.dealership.name} | New & Used Cars`,
    description: `Browse our inventory at ${site.snapshot.dealership.name}.`,
  };
}

export default async function HomePage() {
  const hostname = await getRequestHostname();
  const site = await resolveSite(hostname);
  const { snapshot } = site;
  const primaryColor = snapshot.theme?.primaryColor ?? "#1a56db";

  return (
    <>
      <SiteHeader snapshot={snapshot} />

      <main>
        {/* Hero */}
        <section
          className="relative flex min-h-[480px] items-center justify-center overflow-hidden py-20 text-white"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {snapshot.dealership.name}
            </h1>
            <p className="mt-4 text-lg text-white/80 sm:text-xl">
              Browse our selection of quality new and pre-owned vehicles.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/inventory"
                className="rounded-xl bg-white px-8 py-3 font-semibold transition-opacity hover:opacity-90"
                style={{ color: primaryColor }}
              >
                Browse Inventory
              </Link>
              <Link
                href="/contact"
                className="rounded-xl border-2 border-white/60 px-8 py-3 font-semibold text-white transition-colors hover:border-white"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </section>

        {/* Features strip */}
        <section className="border-y border-gray-100 bg-white py-10">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 sm:grid-cols-4 sm:px-6 lg:px-8">
            {[
              { icon: "🚗", title: "Quality Inventory", desc: "Carefully inspected vehicles" },
              { icon: "💰", title: "Great Prices", desc: "Transparent pricing, no surprises" },
              { icon: "🏦", title: "Easy Financing", desc: "Flexible options available" },
              { icon: "🤝", title: "Trusted Service", desc: "Dedicated customer care" },
            ].map((f) => (
              <div key={f.title} className="text-center">
                <div className="text-3xl">{f.icon}</div>
                <p className="mt-2 font-semibold text-gray-900">{f.title}</p>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        {snapshot.dealership.phone && (
          <section className="bg-gray-50 py-14 text-center">
            <h2 className="text-2xl font-bold text-gray-900">Ready to find your next vehicle?</h2>
            <p className="mt-2 text-gray-600">Call us today or browse our full inventory online.</p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                href={`tel:${snapshot.dealership.phone}`}
                className="rounded-xl px-8 py-3 font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                {snapshot.dealership.phone}
              </a>
              <Link
                href="/inventory"
                className="rounded-xl border-2 border-gray-300 px-8 py-3 font-semibold text-gray-700 transition-colors hover:border-gray-400"
              >
                View Inventory
              </Link>
            </div>
          </section>
        )}
      </main>

      <SiteFooter snapshot={snapshot} />
    </>
  );
}
