"use client";

import { OpportunitiesWorkspacePage } from "./OpportunitiesWorkspacePage";

export function OpportunitiesTablePage() {
  return <OpportunitiesWorkspacePage initialQuery={{ view: "list", scope: "all" }} lockedView="list" />;
}
