/**
 * Global typeahead search across customers, deals, and inventory.
 * Permission-gated: only queries entity types the user has read permission for.
 * Tenant-scoped: all queries filtered by dealershipId.
 */
import * as customerService from "@/modules/customers/service/customer";
import * as dealService from "@/modules/deals/service/deal";
import * as vehicleService from "@/modules/inventory/service/vehicle";

export type GlobalSearchResultItem =
  | {
      type: "customer";
      id: string;
      name: string;
      primaryPhone: string | null;
      primaryEmail: string | null;
    }
  | {
      type: "deal";
      id: string;
      stockNumber: string;
      customerName: string;
    }
  | {
      type: "inventory";
      id: string;
      vin: string | null;
      stockNumber: string;
      yearMakeModel: string;
    };

export type GlobalSearchParams = {
  dealershipId: string;
  q: string;
  limit: number;
  offset: number;
  permissions: string[];
};

export type GlobalSearchResult = {
  data: GlobalSearchResultItem[];
  meta: { limit: number; offset: number };
};

const PER_TYPE_CAP = 10;

/**
 * Run global search: customers (name/phone/email), deals (stock number + customer name), inventory (vin, stock number).
 * Only queries types for which the user has read permission. Returns flat list with type discriminant; order: customers, deals, inventory.
 * Applies global limit and offset to the combined list.
 */
export async function globalSearch(params: GlobalSearchParams): Promise<GlobalSearchResult> {
  const { dealershipId, q, limit, offset, permissions } = params;
  const term = q.trim();
  if (term.length < 2) {
    return { data: [], meta: { limit, offset } };
  }

  const canCustomers = permissions.includes("customers.read");
  const canDeals = permissions.includes("deals.read");
  const canInventory = permissions.includes("inventory.read");

  if (!canCustomers && !canDeals && !canInventory) {
    return { data: [], meta: { limit, offset } };
  }

  const perTypeLimit = Math.min(PER_TYPE_CAP, limit + offset);

  const [customerRows, dealRows, vehicleRows] = await Promise.all([
    canCustomers ? customerService.searchCustomersByTerm(dealershipId, term, perTypeLimit) : [],
    canDeals ? dealService.searchDealsByTerm(dealershipId, term, perTypeLimit) : [],
    canInventory ? vehicleService.searchVehiclesByTerm(dealershipId, term, perTypeLimit) : [],
  ]);

  const customers: GlobalSearchResultItem[] = customerRows.map((c) => ({
    type: "customer" as const,
    id: c.id,
    name: c.name,
    primaryPhone: c.primaryPhone,
    primaryEmail: c.primaryEmail,
  }));
  const deals: GlobalSearchResultItem[] = dealRows.map((d) => ({
    type: "deal" as const,
    id: d.id,
    stockNumber: d.stockNumber,
    customerName: d.customerName,
  }));
  const inventory: GlobalSearchResultItem[] = vehicleRows.map((v) => ({
    type: "inventory" as const,
    id: v.id,
    vin: v.vin,
    stockNumber: v.stockNumber,
    yearMakeModel: v.yearMakeModel,
  }));

  const combined = [...customers, ...deals, ...inventory];
  const data = combined.slice(offset, offset + limit);

  return { data, meta: { limit, offset } };
}
