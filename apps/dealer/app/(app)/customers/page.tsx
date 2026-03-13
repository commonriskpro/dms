import { unstable_noStore as noStore } from "next/cache";
import { getSessionContextOrNull } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
import * as customerService from "@/modules/customers/service/customer";
import * as savedFiltersService from "@/modules/customers/service/saved-filters";
import * as savedSearchesService from "@/modules/customers/service/saved-searches";
import { CustomersPageClient } from "@/modules/customers/ui/CustomersPageClient";
import { CustomersListContent } from "@/modules/customers/ui/CustomersListContent";
import type { CustomerListItem } from "@/lib/types/customers";
import type { CustomerSummaryMetrics } from "@/modules/customers/service/customer";
import type { SavedFilterCatalogItem, SavedSearchCatalogItem } from "@/lib/types/saved-filters-searches";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const SORT_BY_KEYS = ["created_at", "updated_at", "status"] as const;
const SORT_ORDER_KEYS = ["asc", "desc"] as const;

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function parseSearchParams(searchParams: SearchParams) {
  return searchParams.then((p) => {
    const view = typeof p.view === "string" && p.view ? p.view : undefined;
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(String(p.pageSize ?? DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
    );
    const page = Math.max(1, parseInt(String(p.page ?? 1), 10) || 1);
    const sortBy =
      typeof p.sortBy === "string" && SORT_BY_KEYS.includes(p.sortBy as (typeof SORT_BY_KEYS)[number])
        ? (p.sortBy as (typeof SORT_BY_KEYS)[number])
        : "created_at";
    const sortOrder =
      typeof p.sortOrder === "string" && SORT_ORDER_KEYS.includes(p.sortOrder as (typeof SORT_ORDER_KEYS)[number])
        ? (p.sortOrder as (typeof SORT_ORDER_KEYS)[number])
        : "desc";
    const status = typeof p.status === "string" && p.status ? p.status : undefined;
    const draft =
      typeof p.draft === "string" && ["all", "draft", "final"].includes(p.draft)
        ? (p.draft as "all" | "draft" | "final")
        : "all";
    const leadSource = typeof p.leadSource === "string" && p.leadSource ? p.leadSource : undefined;
    const assignedTo = typeof p.assignedTo === "string" && p.assignedTo ? p.assignedTo : undefined;
    const q = typeof p.q === "string" && p.q ? p.q.trim() : undefined;
    const savedSearchId = typeof p.savedSearchId === "string" && p.savedSearchId ? p.savedSearchId : undefined;
    return { view, page, pageSize, sortBy, sortOrder, status, draft, leadSource, assignedTo, q, savedSearchId };
  });
}

function toSavedFilterCatalogItem(f: { id: string; name: string; visibility: string; definitionJson: unknown; createdAt: Date; updatedAt: Date; ownerUserId: string | null }): SavedFilterCatalogItem {
  return {
    id: f.id,
    name: f.name,
    visibility: f.visibility as "PERSONAL" | "SHARED",
    definitionJson: f.definitionJson as SavedFilterCatalogItem["definitionJson"],
    createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : (f.createdAt as string),
    updatedAt: f.updatedAt instanceof Date ? f.updatedAt.toISOString() : (f.updatedAt as string),
    ownerUserId: f.ownerUserId,
  };
}

function toSavedSearchCatalogItem(s: { id: string; name: string; visibility: string; stateJson: unknown; isDefault: boolean; createdAt: Date; updatedAt: Date; ownerUserId: string | null }): SavedSearchCatalogItem {
  return {
    id: s.id,
    name: s.name,
    visibility: s.visibility as "PERSONAL" | "SHARED",
    stateJson: s.stateJson as SavedSearchCatalogItem["stateJson"],
    isDefault: s.isDefault,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : (s.createdAt as string),
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : (s.updatedAt as string),
    ownerUserId: s.ownerUserId,
  };
}

function toSerializedListItem(c: Awaited<ReturnType<typeof customerService.listCustomers>>["data"][number]): CustomerListItem {
  const primaryPhone = c.phones.find((p) => p.isPrimary) ?? c.phones[0];
  const primaryEmail = c.emails.find((e) => e.isPrimary) ?? c.emails[0];
  const cAny = c as typeof c & { lastVisitAt?: Date | null; lastVisitByUserId?: string | null };
  return {
    id: c.id,
    name: c.name,
    isDraft: c.isDraft,
    status: c.status,
    leadSource: c.leadSource,
    assignedTo: c.assignedTo,
    assignedToProfile: c.assignedToProfile,
    primaryPhone: primaryPhone?.value ?? null,
    primaryEmail: primaryEmail?.value ?? null,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : (c.createdAt as string),
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : (c.updatedAt as string),
    lastVisitAt: cAny.lastVisitAt instanceof Date ? cAny.lastVisitAt.toISOString() : (cAny.lastVisitAt ?? null),
    lastVisitByUserId: cAny.lastVisitByUserId ?? null,
  };
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  noStore();
  const session = await getSessionContextOrNull();
  const dealershipId = session?.activeDealershipId ?? null;
  const hasRead = Boolean(dealershipId && session?.permissions?.includes("customers.read"));

  if (!session || !hasRead || !dealershipId) {
    const params = await parseSearchParams(searchParams);
    if (params.view === "list") {
      return (
        <CustomersListContent
          initialData={null}
          canRead={false}
          canWrite={false}
          searchParams={{ view: "list" }}
        />
      );
    }
    return (
      <CustomersPageClient
        initialData={null}
        canRead={false}
        canWrite={false}
        searchParams={{}}
        savedFilters={[]}
        savedSearches={[]}
      />
    );
  }

  const params = await parseSearchParams(searchParams);
  const offset = (params.page - 1) * params.pageSize;
  const listPromise = customerService.listCustomers(dealershipId, {
    limit: params.pageSize,
    offset,
    filters: {
      status: params.status as "LEAD" | "ACTIVE" | "SOLD" | "INACTIVE" | undefined,
      draft: params.draft,
      leadSource: params.leadSource,
      assignedTo: params.assignedTo,
      search: params.q,
    },
    sort: { sortBy: params.sortBy, sortOrder: params.sortOrder },
  });
  const summaryPromise = customerService.getCustomerSummaryMetrics(dealershipId);

  if (params.view === "list") {
    const [listResult, summary] = await Promise.all([listPromise, summaryPromise]);
    const listData = listResult.data.map(toSerializedListItem);

    return (
      <CustomersListContent
        initialData={{
          list: {
            data: listData,
            total: listResult.total,
            page: params.page,
            pageSize: params.pageSize,
          },
          summary,
        }}
        canRead={true}
        canWrite={Boolean(session?.permissions?.includes("customers.write"))}
        searchParams={{
          view: "list",
          page: params.page,
          pageSize: params.pageSize,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          status: params.status,
          draft: params.draft,
          leadSource: params.leadSource,
          assignedTo: params.assignedTo,
          q: params.q,
          savedSearchId: params.savedSearchId,
        }}
      />
    );
  }

  const [listResult, summary, savedFiltersList, savedSearchesList] = await Promise.all([
    listPromise,
    summaryPromise,
    savedFiltersService.listSavedFilters(dealershipId, session.userId),
    savedSearchesService.listSavedSearches(dealershipId, session.userId),
  ]);

  const listData = listResult.data.map(toSerializedListItem);
  const savedFilters = savedFiltersList.map(toSavedFilterCatalogItem);
  const savedSearches = savedSearchesList.map(toSavedSearchCatalogItem);

  return (
    <CustomersPageClient
      initialData={{
        list: {
          data: listData,
          total: listResult.total,
          page: params.page,
          pageSize: params.pageSize,
        },
        summary,
      }}
      canRead={true}
      canWrite={Boolean(session?.permissions?.includes("customers.write"))}
      searchParams={{
        view: params.view,
        page: params.page,
        pageSize: params.pageSize,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        status: params.status,
        draft: params.draft,
        leadSource: params.leadSource,
        assignedTo: params.assignedTo,
        q: params.q,
        savedSearchId: params.savedSearchId,
      }}
      savedFilters={savedFilters}
      savedSearches={savedSearches}
    />
  );
}
