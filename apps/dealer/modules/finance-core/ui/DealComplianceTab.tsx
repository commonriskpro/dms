"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import {
  Dialog,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, type SelectOption } from "@/components/ui/select";
import { MutationButton } from "@/components/write-guard";

const FORM_TYPES = [
  "PRIVACY_NOTICE",
  "ODOMETER_DISCLOSURE",
  "BUYERS_GUIDE",
  "ARBITRATION",
] as const;
const FORM_TYPE_LABELS: Record<string, string> = {
  PRIVACY_NOTICE: "Privacy notice",
  ODOMETER_DISCLOSURE: "Odometer disclosure",
  BUYERS_GUIDE: "Buyer's guide",
  ARBITRATION: "Arbitration",
};

const STATUSES = ["NOT_STARTED", "GENERATED", "REVIEWED", "COMPLETED"] as const;
const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  GENERATED: "Generated",
  REVIEWED: "Reviewed",
  COMPLETED: "Completed",
};

type ComplianceFormItem = {
  id: string;
  dealId: string;
  formType: string;
  status: string;
  generatedPayloadJson: object | null;
  generatedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ComplianceAlertItem = {
  type: string;
  dealId: string;
  message: string;
  severity: "warning" | "error" | "info";
};

const formTypeOptions: SelectOption[] = FORM_TYPES.map((t) => ({
  value: t,
  label: FORM_TYPE_LABELS[t] ?? t,
}));

const statusOptions: SelectOption[] = STATUSES.map((s) => ({
  value: s,
  label: STATUS_LABELS[s] ?? s,
}));

export function DealComplianceTab({ dealId }: { dealId: string }) {
  const { addToast } = useToast();
  const { hasPermission } = useSession();
  const canRead = hasPermission("finance.submissions.read");
  const canWrite = hasPermission("finance.submissions.write");

  const [forms, setForms] = React.useState<ComplianceFormItem[]>([]);
  const [alerts, setAlerts] = React.useState<ComplianceAlertItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [generateType, setGenerateType] = React.useState<string>("PRIVACY_NOTICE");
  const [generateSubmitting, setGenerateSubmitting] = React.useState(false);
  const [updateSubmittingId, setUpdateSubmittingId] = React.useState<string | null>(null);

  const fetchForms = React.useCallback(async () => {
    if (!canRead) return;
    try {
      const res = await apiFetch<{ data: ComplianceFormItem[] }>(
        `/api/compliance-forms?dealId=${encodeURIComponent(dealId)}`
      );
      setForms(res.data ?? []);
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }, [dealId, canRead]);

  const fetchAlerts = React.useCallback(async () => {
    if (!canRead) return;
    try {
      const res = await apiFetch<{ data: ComplianceAlertItem[] }>(
        `/api/compliance-alerts?dealId=${encodeURIComponent(dealId)}`
      );
      setAlerts(res.data ?? []);
    } catch (_) {
      setAlerts([]);
    }
  }, [dealId, canRead]);

  const load = React.useCallback(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch<{ data: ComplianceFormItem[] }>(
        `/api/compliance-forms?dealId=${encodeURIComponent(dealId)}`
      ),
      apiFetch<{ data: ComplianceAlertItem[] }>(
        `/api/compliance-alerts?dealId=${encodeURIComponent(dealId)}`
      ),
    ])
      .then(([formsRes, alertsRes]) => {
        setForms(formsRes.data ?? []);
        setAlerts(alertsRes.data ?? []);
      })
      .catch((e) => setError(getApiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [dealId, canRead]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleGenerate = async () => {
    if (!canWrite) return;
    setGenerateSubmitting(true);
    try {
      await apiFetch(`/api/compliance-forms/generate`, {
        method: "POST",
        body: JSON.stringify({ dealId, formType: generateType }),
      });
      addToast("success", "Form generated");
      setGenerateOpen(false);
      fetchForms();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setGenerateSubmitting(false);
    }
  };

  const handleStatusChange = async (form: ComplianceFormItem, newStatus: string) => {
    if (!canWrite) return;
    setUpdateSubmittingId(form.id);
    try {
      await apiFetch(`/api/compliance-forms/${form.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: newStatus,
          completedAt: newStatus === "COMPLETED" ? new Date().toISOString() : null,
        }),
      });
      addToast("success", "Status updated");
      fetchForms();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setUpdateSubmittingId(null);
    }
  };

  if (!canRead) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-[var(--muted-text)]">
            You don&apos;t have permission to view compliance.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ErrorState message={error} />
        </CardContent>
      </Card>
    );
  }

  const formByType = Object.fromEntries(forms.map((f) => [f.formType, f]));

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Compliance alerts</CardTitle>
            <p className="text-sm text-[var(--muted-text)]">
              Missing forms, stipulations, or lender decisions.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : alerts.length === 0 ? (
            <p className="text-sm text-[var(--muted-text)]">No alerts for this deal.</p>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a, i) => (
                <li
                  key={`${a.type}-${a.dealId}-${i}`}
                  className={`text-sm ${
                    a.severity === "error"
                      ? "text-[var(--danger)]"
                      : a.severity === "warning"
                        ? "text-[var(--warning)]"
                        : "text-[var(--text-soft)]"
                  }`}
                >
                  {a.message}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Compliance forms</CardTitle>
            <p className="text-sm text-[var(--muted-text)]">
              Generate and track required forms (privacy, odometer, buyer&apos;s guide, arbitration).
            </p>
          </div>
          {canWrite && (
            <Button variant="secondary" size="sm" onClick={() => setGenerateOpen(true)}>
              Generate form
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Completed</TableHead>
                  {canWrite && <TableHead className="w-[200px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {FORM_TYPES.map((formType) => {
                  const instance = formByType[formType];
                  return (
                    <TableRow key={formType}>
                      <TableCell className="font-medium">
                        {FORM_TYPE_LABELS[formType] ?? formType}
                      </TableCell>
                      <TableCell>
                        {instance ? STATUS_LABELS[instance.status] ?? instance.status : "—"}
                      </TableCell>
                      <TableCell className="text-[var(--text-soft)]">
                        {instance?.generatedAt
                          ? new Date(instance.generatedAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-[var(--text-soft)]">
                        {instance?.completedAt
                          ? new Date(instance.completedAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      {canWrite && (
                        <TableCell>
                          {instance ? (
                            <Select
                              value={instance.status}
                              options={statusOptions}
                              onChange={(v) => handleStatusChange(instance, v)}
                              className="w-[140px]"
                              disabled={updateSubmittingId === instance.id}
                            />
                          ) : (
                            <MutationButton
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setGenerateType(formType);
                                setGenerateOpen(true);
                              }}
                            >
                              Generate
                            </MutationButton>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogHeader>
          <DialogTitle>Generate compliance form</DialogTitle>
          <DialogDescription>
            Generate form content from deal, customer, and vehicle data.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Select
            label="Form type"
            options={formTypeOptions}
            value={generateType}
            onChange={setGenerateType}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setGenerateOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={generateSubmitting}>
            {generateSubmitting ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
