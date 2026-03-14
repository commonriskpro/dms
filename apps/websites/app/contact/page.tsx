import { type Metadata } from "next";
import { getRequestHostname } from "@/lib/hostname";
import { resolveSite } from "@/lib/site-resolver";
import { SiteHeader } from "@/templates/premium-default/SiteHeader";
import { SiteFooter } from "@/templates/premium-default/SiteFooter";
import { LeadForm } from "@/templates/premium-default/LeadForm";

export async function generateMetadata(): Promise<Metadata> {
  const hostname = await getRequestHostname();
  const site = await resolveSite(hostname);
  return {
    title: `Contact Us | ${site.snapshot.dealership.name}`,
    description: `Get in touch with ${site.snapshot.dealership.name}.`,
  };
}

export default async function ContactPage() {
  const hostname = await getRequestHostname();
  const site = await resolveSite(hostname);
  const { snapshot } = site;
  const primaryColor = snapshot.theme?.primaryColor ?? "#1a56db";
  const contact = snapshot.dealership;

  return (
    <>
      <SiteHeader snapshot={snapshot} />

      <main className="min-h-screen bg-gray-50">
        <div className="border-b border-gray-200 bg-white py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-gray-900">Contact Us</h1>
            <p className="mt-1 text-gray-500">We&apos;d love to hear from you.</p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2">
            {/* Contact info */}
            <div className="space-y-6">
              {contact?.phone && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Phone</h3>
                  <a
                    href={`tel:${contact.phone}`}
                    className="mt-1 text-2xl font-bold transition-opacity hover:opacity-80"
                    style={{ color: primaryColor }}
                  >
                    {contact.phone}
                  </a>
                </div>
              )}
              {contact?.email && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Email</h3>
                  <a
                    href={`mailto:${contact.email}`}
                    className="mt-1 text-lg font-medium text-gray-800 transition-opacity hover:opacity-80"
                  >
                    {contact.email}
                  </a>
                </div>
              )}
              {contact?.addressLine1 && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Address</h3>
                  <address className="mt-1 text-lg not-italic text-gray-800">
                    {contact.addressLine1}
                    {contact.city && (
                      <>
                        <br />
                        {[contact.city, contact.state, contact.zip].filter(Boolean).join(", ")}
                      </>
                    )}
                  </address>
                </div>
              )}
              {contact?.hours && Object.keys(contact.hours).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Hours</h3>
                  <dl className="mt-2 space-y-1">
                    {Object.entries(contact.hours).map(([day, hrs]) => (
                      <div key={day} className="flex justify-between text-sm">
                        <dt className="font-medium text-gray-700">{day}</dt>
                        <dd className="text-gray-600">{String(hrs)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>

            {/* Form */}
            <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
              <LeadForm
                formType="CONTACT"
                primaryColor={primaryColor}
              />
            </div>
          </div>
        </div>
      </main>

      <SiteFooter snapshot={snapshot} />
    </>
  );
}
