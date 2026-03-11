import CustomersPage from "../page";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default function CustomersListRoute({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return CustomersPage({
    searchParams: searchParams.then((params) => ({
      ...params,
      view: "list",
    })),
  });
}
