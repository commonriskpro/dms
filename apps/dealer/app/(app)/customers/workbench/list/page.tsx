import CustomersListRoute from "../../list/page";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default function CustomersWorkbenchListRoute({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return CustomersListRoute({ searchParams });
}
