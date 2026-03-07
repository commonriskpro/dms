import { InboxPageClient } from "./InboxPageClient";

export const dynamic = "force-dynamic";

type SearchParams = { customerId?: string };

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { customerId: initialCustomerId } = await searchParams;
  return <InboxPageClient initialCustomerId={initialCustomerId ?? null} />;
}
