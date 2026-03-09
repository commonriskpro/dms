"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { PageHeader } from "@/components/ui/page-shell";
import { typography } from "@/lib/ui/tokens";
import { sectionStack } from "@/lib/ui/recipes/layout";
import { PricingRulesManager } from "./PricingRulesManager";

export type PricingRulesPageClientProps = {
  canWrite: boolean;
};

export function PricingRulesPageClient({ canWrite }: PricingRulesPageClientProps) {
  const router = useRouter();
  const [rules, setRules] = React.useState<Array<{
    id: string;
    name: string;
    ruleType: string;
    daysInStock: number | null;
    adjustmentPercent: number | null;
    adjustmentCents: number | null;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
  }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchRules = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: typeof rules }>("/api/inventory/pricing-rules");
      setRules(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  return (
    <div className={sectionStack}>
      <PageHeader title={<h1 className={typography.pageTitle}>Pricing rules</h1>} />
      <PricingRulesManager
        rules={rules}
        loading={loading}
        error={error}
        canWrite={canWrite}
        onMutate={() => { fetchRules(); router.refresh(); }}
      />
    </div>
  );
}
