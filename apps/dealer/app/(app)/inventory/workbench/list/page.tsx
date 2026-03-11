import InventoryListRoute from "../../list/page";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function InventoryWorkbenchListRoute({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return InventoryListRoute({ searchParams });
}
