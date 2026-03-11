import AppraisalsRoute from "../../appraisals/page";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function InventoryWorkbenchAppraisalsRoute({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return AppraisalsRoute({ searchParams });
}
