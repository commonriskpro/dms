/** Filter definition only (no q, sort, limit). Used in SavedFilter and inside SavedSearch state. */
export type SavedFilterDefinition = {
  status?: string;
  draft?: "all" | "draft" | "final";
  leadSource?: string;
  assignedTo?: string;
  lastVisit?: string;
  callbacks?: 0 | 1;
};

/** Saved filter catalog item (from server). */
export type SavedFilterCatalogItem = {
  id: string;
  name: string;
  visibility: "PERSONAL" | "SHARED";
  definitionJson: SavedFilterDefinition;
  createdAt: string;
  updatedAt: string;
  ownerUserId: string | null;
};

/** Full list view state (q + filters + sort + limit). */
export type SavedSearchState = {
  q?: string;
  status?: string;
  draft?: "all" | "draft" | "final";
  leadSource?: string;
  assignedTo?: string;
  lastVisit?: string;
  callbacks?: 0 | 1;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
  columns?: string[];
  density?: string;
};

/** Saved search catalog item (from server). */
export type SavedSearchCatalogItem = {
  id: string;
  name: string;
  visibility: "PERSONAL" | "SHARED";
  stateJson: SavedSearchState;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  ownerUserId: string | null;
};
