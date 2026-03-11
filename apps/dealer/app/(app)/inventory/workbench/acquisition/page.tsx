import AcquisitionRoute from "../../acquisition/page";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function InventoryWorkbenchAcquisitionRoute({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return AcquisitionRoute({ searchParams });
}
