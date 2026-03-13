"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { MutationButton, WriteGuard } from "@/components/write-guard";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDealMode, type DealDetail } from "./types";

const TITLE_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  TITLE_PENDING: "Title pending",
  TITLE_SENT: "Sent to DMV",
  TITLE_RECEIVED: "Received from DMV",
  TITLE_COMPLETED: "Completed",
  ISSUE_HOLD: "Issue / hold",
};

export type DealTitleDmvTabProps = {
  deal: DealDetail;
  dealId: string;
  onDealUpdated: (updated: DealDetail) => void;
  canWrite: boolean;
};

export function DealTitleDmvTab({
  deal,
  dealId,
  onDealUpdated,
  canWrite,
}: DealTitleDmvTabProps) {
  const { addToast } = useToast();
  const dealMode = getDealMode(deal);
  const [titleLoading, setTitleLoading] = React.useState(false);
  const [checklistLoading, setChecklistLoading] = React.useState(false);
  const [checklist, setChecklist] = React.useState<Array<{ id: string; label: string; completed: boolean; completedAt: string | null }>>(
    deal.dealDmvChecklistItems?.map((i) => ({ id: i.id, label: i.label, completed: i.completed, completedAt: i.completedAt })) ?? []
  );

  const refreshDeal = React.useCallback(async () => {
    const res = await apiFetch<{ data: DealDetail }>(`/api/deals/${dealId}`);
    onDealUpdated(res.data);
    if (res.data.dealDmvChecklistItems) {
      setChecklist(
        res.data.dealDmvChecklistItems.map((i) => ({
          id: i.id,
          label: i.label,
          completed: i.completed,
          completedAt: i.completedAt,
        }))
      );
    }
  }, [dealId, onDealUpdated]);

  const startTitle = async () => {
    if (!canWrite) return;
    setTitleLoading(true);
    try {
      await apiFetch(`/api/deals/${dealId}/title/start`, { method: "POST" });
      await refreshDeal();
      addToast("success", "Title process started");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setTitleLoading(false);
    }
  };

  const markTitleSent = async () => {
    if (!canWrite) return;
    setTitleLoading(true);
    try {
      await apiFetch(`/api/deals/${dealId}/title/status`, {
        method: "PATCH",
        body: JSON.stringify({ titleStatus: "TITLE_SENT" }),
      });
      await refreshDeal();
      addToast("success", "Marked sent to DMV");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setTitleLoading(false);
    }
  };

  const markTitleReceived = async () => {
    if (!canWrite) return;
    setTitleLoading(true);
    try {
      await apiFetch(`/api/deals/${dealId}/title/status`, {
        method: "PATCH",
        body: JSON.stringify({ titleStatus: "TITLE_RECEIVED" }),
      });
      await refreshDeal();
      addToast("success", "Marked received from DMV");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setTitleLoading(false);
    }
  };

  const completeTitle = async () => {
    if (!canWrite) return;
    setTitleLoading(true);
    try {
      await apiFetch(`/api/deals/${dealId}/title/status`, {
        method: "PATCH",
        body: JSON.stringify({ titleStatus: "TITLE_COMPLETED" }),
      });
      await refreshDeal();
      addToast("success", "Title completed");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setTitleLoading(false);
    }
  };

  const placeOnHold = async () => {
    if (!canWrite) return;
    setTitleLoading(true);
    try {
      await apiFetch(`/api/deals/${dealId}/title/status`, {
        method: "PATCH",
        body: JSON.stringify({ titleStatus: "ISSUE_HOLD" }),
      });
      await refreshDeal();
      addToast("success", "Title placed on hold");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setTitleLoading(false);
    }
  };

  const seedChecklist = async () => {
    if (!canWrite) return;
    setChecklistLoading(true);
    try {
      await apiFetch(`/api/deals/${dealId}/dmv-checklist`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await refreshDeal();
      addToast("success", "Checklist created");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setChecklistLoading(false);
    }
  };

  const toggleChecklistItem = async (itemId: string, completed: boolean) => {
    if (!canWrite) return;
    setChecklistLoading(true);
    try {
      await apiFetch(`/api/deals/dmv-checklist/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ completed }),
      });
      setChecklist((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, completed, completedAt: completed ? new Date().toISOString() : null } : i))
      );
      addToast("success", completed ? "Item marked complete" : "Item unchecked");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setChecklistLoading(false);
    }
  };

  const title = deal.dealTitle ?? null;
  const isContracted = deal.status === "CONTRACTED";
  const checklistItems = checklist.length > 0 ? checklist : (deal.dealDmvChecklistItems ?? []);

  return (
    <div className="space-y-6">
      {!isContracted && (
        <p className="text-sm text-[var(--text-soft)]">
          Title and DMV tracking open once the {dealMode === "FINANCE" ? "finance contract" : "cash contract"} is finalized.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Title status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!title ? (
            <>
              <p className="text-sm text-[var(--text-soft)]">No title record yet.</p>
              {isContracted && canWrite && (
                <WriteGuard>
                  <MutationButton onClick={startTitle} disabled={titleLoading}>
                    {titleLoading ? "Starting…" : "Start title process"}
                  </MutationButton>
                </WriteGuard>
              )}
            </>
          ) : (
            <>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-[var(--text-soft)]">Status</dt>
                  <dd>
                    <StatusBadge variant={title.titleStatus === "TITLE_COMPLETED" ? "success" : title.titleStatus === "ISSUE_HOLD" ? "danger" : "info"}>
                      {TITLE_STATUS_LABELS[title.titleStatus] ?? title.titleStatus}
                    </StatusBadge>
                  </dd>
                </div>
                {title.titleNumber && (
                  <div>
                    <dt className="text-[var(--text-soft)]">Title number</dt>
                    <dd>{title.titleNumber}</dd>
                  </div>
                )}
                {title.lienholderName && (
                  <div>
                    <dt className="text-[var(--text-soft)]">
                      {dealMode === "FINANCE" ? "Lienholder" : "Ownership contact"}
                    </dt>
                    <dd>{title.lienholderName}</dd>
                  </div>
                )}
                {title.sentToDmvAt && (
                  <div>
                    <dt className="text-[var(--text-soft)]">Sent to DMV</dt>
                    <dd>{new Date(title.sentToDmvAt).toLocaleDateString()}</dd>
                  </div>
                )}
                {title.receivedFromDmvAt && (
                  <div>
                    <dt className="text-[var(--text-soft)]">Received from DMV</dt>
                    <dd>{new Date(title.receivedFromDmvAt).toLocaleDateString()}</dd>
                  </div>
                )}
              </dl>
              {canWrite && title.titleStatus !== "TITLE_COMPLETED" && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {title.titleStatus === "TITLE_PENDING" && (
                    <MutationButton onClick={markTitleSent} disabled={titleLoading}>Mark sent to DMV</MutationButton>
                  )}
                  {title.titleStatus === "TITLE_SENT" && (
                    <MutationButton onClick={markTitleReceived} disabled={titleLoading}>Mark title received</MutationButton>
                  )}
                  {(title.titleStatus === "TITLE_RECEIVED" || title.titleStatus === "TITLE_SENT") && (
                    <MutationButton onClick={completeTitle} disabled={titleLoading}>Complete title</MutationButton>
                  )}
                  {title.titleStatus !== "ISSUE_HOLD" && (
                    <Button variant="secondary" size="sm" onClick={placeOnHold} disabled={titleLoading}>Place on hold</Button>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lien release</CardTitle>
        </CardHeader>
        <CardContent>
          {title?.lienholderName || title?.lienReleasedAt ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {title?.lienholderName && (
                <div>
                  <dt className="text-[var(--text-soft)]">Lienholder</dt>
                  <dd>{title.lienholderName}</dd>
                </div>
              )}
              {title?.lienReleasedAt && (
                <div>
                  <dt className="text-[var(--text-soft)]">Lien released at</dt>
                  <dd>{new Date(title.lienReleasedAt).toLocaleString()}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-[var(--text-soft)]">No lien information. Update title status to set lienholder or release date.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">DMV checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {checklistItems.length === 0 ? (
            <>
              <p className="text-sm text-[var(--text-soft)]">No checklist items. Create the default post-sale checklist.</p>
              {isContracted && canWrite && (
                <WriteGuard>
                  <MutationButton onClick={seedChecklist} disabled={checklistLoading}>
                    {checklistLoading ? "Creating…" : "Create checklist"}
                  </MutationButton>
                </WriteGuard>
              )}
            </>
          ) : (
            <ul className="space-y-2" role="list">
              {checklistItems.map((item) => (
                <li key={item.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => toggleChecklistItem(item.id, !item.completed)}
                    disabled={!canWrite || checklistLoading}
                    className="rounded border-[var(--border)]"
                  />
                  <span className={item.completed ? "text-[var(--text-soft)] line-through" : ""}>{item.label}</span>
                  {item.completedAt && (
                    <span className="text-xs text-[var(--text-soft)]">
                      {new Date(item.completedAt).toLocaleDateString()}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Title queue</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href="/deals/title">
            <Button variant="secondary" size="sm">View title queue</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
