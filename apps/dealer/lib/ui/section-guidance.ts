"use client";

import * as React from "react";

/** Shared localStorage key prefix for "Hide walkthrough" / "Show walkthrough again". Same key used on dashboard and list pages so preference is global per dealership. */
export const SECTION_GUIDANCE_STORAGE_PREFIX = "dealer-dashboard-executive-guidance:v1:";

export function useSectionGuidance(activeDealershipId?: string | null) {
  const guidanceStorageKey = React.useMemo(
    () => `${SECTION_GUIDANCE_STORAGE_PREFIX}${activeDealershipId ?? "global"}`,
    [activeDealershipId]
  );

  const [showSectionGuidance, setShowSectionGuidance] = React.useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem(guidanceStorageKey) !== "hidden";
    } catch {
      return true;
    }
  });

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(guidanceStorageKey);
      setShowSectionGuidance(stored !== "hidden");
    } catch {
      setShowSectionGuidance(true);
    }
  }, [guidanceStorageKey]);

  const dismissSectionGuidance = React.useCallback(() => {
    setShowSectionGuidance(false);
    try {
      window.localStorage.setItem(guidanceStorageKey, "hidden");
    } catch {
      // ignore
    }
  }, [guidanceStorageKey]);

  const restoreSectionGuidance = React.useCallback(() => {
    setShowSectionGuidance(true);
    try {
      window.localStorage.removeItem(guidanceStorageKey);
    } catch {
      // ignore
    }
  }, [guidanceStorageKey]);

  return { showSectionGuidance, dismissSectionGuidance, restoreSectionGuidance };
}
