"use client";

import { OpportunitiesWorkspacePage } from "./OpportunitiesWorkspacePage";

export function CrmBoardPage() {
  return <OpportunitiesWorkspacePage initialQuery={{ view: "board", scope: "all" }} lockedView="board" />;
}
