import type { PublishSnapshot } from "@dms/contracts";

type Props = {
  snapshot: PublishSnapshot;
};

export function SiteFooter({ snapshot }: Props) {
  const { dealership, social, theme } = snapshot;
  const primaryColor = theme?.primaryColor ?? "#1a56db";
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-gray-900 text-gray-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <h3 className="text-lg font-semibold text-white">{dealership.name}</h3>
            {dealership.addressLine1 && (
              <address className="mt-3 text-sm not-italic leading-relaxed">
                {dealership.addressLine1}
                {dealership.city && (
                  <>
                    <br />
                    {[dealership.city, dealership.state, dealership.zip].filter(Boolean).join(", ")}
                  </>
                )}
              </address>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Contact</h4>
            <ul className="mt-3 space-y-2 text-sm">
              {dealership.phone && (
                <li>
                  <a href={`tel:${dealership.phone}`} className="hover:text-white transition-colors">
                    {dealership.phone}
                  </a>
                </li>
              )}
              {dealership.email && (
                <li>
                  <a href={`mailto:${dealership.email}`} className="hover:text-white transition-colors">
                    {dealership.email}
                  </a>
                </li>
              )}
            </ul>
          </div>

          {social && (social.facebook || social.instagram || social.twitter) && (
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Follow Us</h4>
              <ul className="mt-3 space-y-2 text-sm">
                {social.facebook && (
                  <li>
                    <a href={social.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                      Facebook
                    </a>
                  </li>
                )}
                {social.instagram && (
                  <li>
                    <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                      Instagram
                    </a>
                  </li>
                )}
                {social.twitter && (
                  <li>
                    <a href={social.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                      X (Twitter)
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-8 border-t border-gray-800 pt-8 text-center text-xs text-gray-500">
          &copy; {year} {dealership.name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
