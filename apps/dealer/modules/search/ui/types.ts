/**
 * Client-side types for global search API response.
 * Matches backend shape from modules/search/service/global-search.ts.
 */
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

export type GlobalSearchApiResponse = {
  data: GlobalSearchResultItem[];
  meta: { limit: number; offset: number };
};
