"use client";

import { useCallback, useState } from "react";

export type RefreshSignal = {
  token: number;
  bump: () => void;
};

/**
 * Local refresh signal for widget refetch (e.g. dashboard).
 * bump() increments token; widgets that receive token refetch when it changes.
 */
export function useRefreshSignal(): RefreshSignal {
  const [token, setToken] = useState(0);
  const bump = useCallback(() => {
    setToken((t) => t + 1);
  }, []);
  return { token, bump };
}
