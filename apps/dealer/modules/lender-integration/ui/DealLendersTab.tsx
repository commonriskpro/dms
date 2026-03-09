"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { HttpError } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { Select, type SelectOption } from "@/components/ui/select";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { MutationButton, WriteGuard } from "@/components/write-guard";
import { formatCents, parseDollarsToCents, centsToDollarInput } from "@/lib/money";
import { bpsToPercent, percentToBps } from "@/lib/money";
import type { Lender, LendersListResponse } from "@/lib/types/lenders";
import type {
  FinanceApplication,
  FinanceApplicant,
  FinanceSubmission,
  FinanceStipulation,
  FinanceApplicantRole,
  FinanceSubmissionStatus,
  FinanceDecisionStatus,
  FinanceFundingStatus,
  FinanceStipulationType,
  FinanceStipulationStatus,
} from "@/lib/types/lender-app";
import {
  SUBMISSION_STATUS_NEXT,
  STIP_TYPE_OPTIONS,
  STIP_STATUS_OPTIONS,
  DECISION_STATUS_OPTIONS,
  FUNDING_STATUS_OPTIONS,
} from "@/lib/types/lender-app";
import type { DocumentItem, DocumentsListResponse } from "@/modules/documents/ui/types";

const SUBMISSIONS_PAGE_SIZE = 25;
const STIPS_PAGE_SIZE = 50;

/** Permission gate: when false, no applications/submissions fetch. Used by tests. */
export function shouldFetchSubmissions(canRead: boolean): boolean {
  return !!canRead;
}

/** Permission gate: when false, no /api/documents fetch for stip linking. Used by tests. */
export function shouldFetchDealDocuments(canRead: boolean): boolean {
  return !!canRead;
}

/** Permission gate: when false, no /api/lenders fetch. Used by tests. */
export function shouldFetchLenders(canRead: boolean): boolean {
  return !!canRead;
}

interface ApplicationsListResponse {
  data: FinanceApplication[];
  meta: { total: number; limit: number; offset: number };
}

interface SubmissionsListResponse {
  data: FinanceSubmission[];
  meta: { total: number; limit: number; offset: number };
}

interface StipulationsListResponse {
  data: FinanceStipulation[];
  meta: { total: number; limit: number; offset: number };
}

const stipTypeSelectOptions: SelectOption[] = STIP_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));
const stipStatusSelectOptions: SelectOption[] = STIP_STATUS_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));
const decisionStatusSelectOptions: SelectOption[] = DECISION_STATUS_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));
const fundingStatusSelectOptions: SelectOption[] = FUNDING_STATUS_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

function ViewDocumentLink({ documentId }: { documentId: string }) {
  const [loading, setLoading] = React.useState(false);
  const { addToast } = useToast();
  const openDocument = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ url: string }>(
        `/api/documents/signed-url?documentId=${encodeURIComponent(documentId)}`
      );
      if (res?.url) window.open(res.url, "_blank", "noopener");
      else addToast("error", "Could not get document link.");
    } catch {
      addToast("error", "Could not open document.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-auto p-0 text-sm font-normal text-[var(--accent)]"
      onClick={openDocument}
      disabled={loading}
      aria-label="View document"
    >
      {loading ? "Opening…" : "View document"}
    </Button>
  );
}

function submissionStatusToVariant(status: FinanceSubmissionStatus): "info" | "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "DRAFT":
      return "neutral";
    case "READY_TO_SUBMIT":
    case "SUBMITTED":
      return "info";
    case "DECISIONED":
      return "warning";
    case "FUNDED":
      return "success";
    case "CANCELED":
      return "danger";
    default:
      return "neutral";
  }
}

export function DealLendersTab({
  dealId,
  dealStatus,
}: {
  dealId: string;
  dealStatus: string;
}) {
  const { hasPermission } = useSession();
  const { addToast } = useToast();
  const canReadLenders = hasPermission("lenders.read");
  const canReadSubmissions = hasPermission("finance.submissions.read");
  const canWriteSubmissions = hasPermission("finance.submissions.write");
  const canReadDocs = hasPermission("documents.read");

  const isDealContracted = dealStatus === "CONTRACTED";
  const isDealCanceled = dealStatus === "CANCELED";
  const canWriteHere = canWriteSubmissions && !isDealCanceled;

  const [applications, setApplications] = React.useState<FinanceApplication[]>([]);
  const [applicationsMeta, setApplicationsMeta] = React.useState({
    total: 0,
    limit: 25,
    offset: 0,
  });
  const [application, setApplication] = React.useState<FinanceApplication | null>(null);
  const [applicationsLoading, setApplicationsLoading] = React.useState(false);
  const [applicationsError, setApplicationsError] = React.useState<string | null>(null);

  const [lenders, setLenders] = React.useState<Lender[]>([]);
  const [lendersLoading, setLendersLoading] = React.useState(false);
  const [lenderId, setLenderId] = React.useState("");
  const [reserveEstDollars, setReserveEstDollars] = React.useState("");
  const [createSubmissionLoading, setCreateSubmissionLoading] = React.useState(false);
  const [createSubmissionError, setCreateSubmissionError] = React.useState<string | null>(null);

  const [submissions, setSubmissions] = React.useState<FinanceSubmission[]>([]);
  const [submissionsMeta, setSubmissionsMeta] = React.useState({
    total: 0,
    limit: SUBMISSIONS_PAGE_SIZE,
    offset: 0,
  });
  const [submissionsLoading, setSubmissionsLoading] = React.useState(false);
  const [submissionsError, setSubmissionsError] = React.useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = React.useState<string | null>(null);

  const [submissionDetail, setSubmissionDetail] = React.useState<FinanceSubmission | null>(null);
  const [submissionDetailLoading, setSubmissionDetailLoading] = React.useState(false);
  const [submissionDetailError, setSubmissionDetailError] = React.useState<string | null>(null);

  const [applicantPrimary, setApplicantPrimary] = React.useState<Partial<FinanceApplicant>>({});
  const [applicantCo, setApplicantCo] = React.useState<Partial<FinanceApplicant> | null>(null);
  const [hasCoApplicant, setHasCoApplicant] = React.useState(false);
  const [applicationSaveLoading, setApplicationSaveLoading] = React.useState(false);
  const [applicationFormError, setApplicationFormError] = React.useState<string | null>(null);

  const applicationId = application?.id ?? null;

  const fetchApplications = React.useCallback(async () => {
    if (!shouldFetchSubmissions(canReadSubmissions)) return;
    setApplicationsLoading(true);
    setApplicationsError(null);
    try {
      const res = await apiFetch<ApplicationsListResponse>(
        `/api/deals/${dealId}/applications?limit=25&offset=0`
      );
      setApplications(res.data ?? []);
      setApplicationsMeta(res.meta ?? { total: 0, limit: 25, offset: 0 });
      if (res.data?.length && !applicationId) {
        setApplication(res.data[0]);
      }
    } catch (e) {
      setApplicationsError(getApiErrorMessage(e));
    } finally {
      setApplicationsLoading(false);
    }
  }, [dealId, canReadSubmissions, applicationId]);

  const fetchApplicationDetail = React.useCallback(
    async (appId: string) => {
      if (!shouldFetchSubmissions(canReadSubmissions)) return;
      try {
        const res = await apiFetch<{ data: FinanceApplication }>(
          `/api/deals/${dealId}/applications/${appId}`
        );
        const app = res.data;
        setApplication(app);
        const primary = app.applicants?.find((a) => a.role === "PRIMARY");
        const co = app.applicants?.find((a) => a.role === "CO");
        setApplicantPrimary({
          fullName: primary?.fullName ?? "",
          email: primary?.email ?? "",
          phone: primary?.phone ?? "",
          addressLine1: primary?.addressLine1 ?? "",
          addressLine2: primary?.addressLine2 ?? "",
          city: primary?.city ?? "",
          region: primary?.region ?? "",
          postalCode: primary?.postalCode ?? "",
          country: primary?.country ?? "",
          employerName: primary?.employerName ?? "",
        });
        setHasCoApplicant(!!co);
        setApplicantCo(
          co
            ? {
                fullName: co.fullName ?? "",
                email: co.email ?? "",
                phone: co.phone ?? "",
                addressLine1: co.addressLine1 ?? "",
                addressLine2: co.addressLine2 ?? "",
                city: co.city ?? "",
                region: co.region ?? "",
                postalCode: co.postalCode ?? "",
                country: co.country ?? "",
                employerName: co.employerName ?? "",
              }
            : null
        );
      } catch {
        // keep existing application list state
      }
    },
    [dealId, canReadSubmissions]
  );

  const fetchLenders = React.useCallback(async () => {
    if (!shouldFetchLenders(canReadLenders)) return;
    setLendersLoading(true);
    try {
      const res = await apiFetch<LendersListResponse>(
        "/api/lenders?activeOnly=true&limit=100&offset=0"
      );
      setLenders(res.data ?? []);
    } finally {
      setLendersLoading(false);
    }
  }, [canReadLenders]);

  const fetchSubmissions = React.useCallback(
    async (offset = 0) => {
      if (!shouldFetchSubmissions(canReadSubmissions) || !applicationId) return;
      setSubmissionsLoading(true);
      setSubmissionsError(null);
      try {
        const res = await apiFetch<SubmissionsListResponse>(
          `/api/deals/${dealId}/applications/${applicationId}/submissions?limit=${SUBMISSIONS_PAGE_SIZE}&offset=${offset}`
        );
        setSubmissions(res.data ?? []);
        setSubmissionsMeta(res.meta ?? { total: 0, limit: SUBMISSIONS_PAGE_SIZE, offset: 0 });
      } catch (e) {
        setSubmissionsError(getApiErrorMessage(e));
      } finally {
        setSubmissionsLoading(false);
      }
    },
    [dealId, applicationId, canReadSubmissions]
  );

  React.useEffect(() => {
    if (!canReadSubmissions) return;
    fetchApplications();
  }, [canReadSubmissions, dealId, fetchApplications]);

  React.useEffect(() => {
    if (application?.id) fetchApplicationDetail(application.id);
  }, [application?.id, fetchApplicationDetail]);

  React.useEffect(() => {
    if (canReadLenders) fetchLenders();
  }, [canReadLenders, fetchLenders]);

  React.useEffect(() => {
    if (applicationId && canReadSubmissions) fetchSubmissions(0);
    else setSubmissions([]);
  }, [applicationId, canReadSubmissions, fetchSubmissions]);

  React.useEffect(() => {
    if (!selectedSubmissionId || !applicationId) {
      setSubmissionDetail(null);
      return;
    }
    setSubmissionDetailLoading(true);
    setSubmissionDetailError(null);
    apiFetch<{ data: FinanceSubmission }>(
      `/api/deals/${dealId}/applications/${applicationId}/submissions/${selectedSubmissionId}`
    )
      .then((res) => {
        setSubmissionDetail(res.data);
      })
      .catch((e) => {
        setSubmissionDetailError(getApiErrorMessage(e));
      })
      .finally(() => setSubmissionDetailLoading(false));
  }, [dealId, applicationId, selectedSubmissionId]);

  const createApplication = async () => {
    if (!canWriteSubmissions || isDealCanceled) return;
    setApplicationSaveLoading(true);
    setApplicationsError(null);
    try {
      const res = await apiFetch<{ data: FinanceApplication }>(
        `/api/deals/${dealId}/applications`,
        { method: "POST", body: JSON.stringify({}) }
      );
      setApplication(res.data);
      setApplications((prev) => [res.data, ...prev]);
      setApplicantPrimary({});
      setApplicantCo(null);
      setHasCoApplicant(false);
      addToast("success", "Finance application created");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setApplicationSaveLoading(false);
    }
  };

  const saveApplication = async () => {
    if (!canWriteHere || !application) return;
    if (!applicantPrimary.fullName?.trim()) {
      setApplicationFormError("Primary applicant full name is required.");
      return;
    }
    setApplicationSaveLoading(true);
    setApplicationFormError(null);
    try {
      const applicants: Array<{
        role: FinanceApplicantRole;
        fullName: string;
        email?: string;
        phone?: string;
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        region?: string;
        postalCode?: string;
        country?: string;
        employerName?: string;
      }> = [
        {
          role: "PRIMARY",
          fullName: applicantPrimary.fullName.trim(),
          email: applicantPrimary.email?.trim() || undefined,
          phone: applicantPrimary.phone?.trim() || undefined,
          addressLine1: applicantPrimary.addressLine1?.trim() || undefined,
          addressLine2: applicantPrimary.addressLine2?.trim() || undefined,
          city: applicantPrimary.city?.trim() || undefined,
          region: applicantPrimary.region?.trim() || undefined,
          postalCode: applicantPrimary.postalCode?.trim() || undefined,
          country: applicantPrimary.country?.trim() || undefined,
          employerName: applicantPrimary.employerName?.trim() || undefined,
        },
      ];
      if (hasCoApplicant && applicantCo) {
        applicants.push({
          role: "CO",
          fullName: applicantCo.fullName?.trim() || "",
          email: applicantCo.email?.trim() || undefined,
          phone: applicantCo.phone?.trim() || undefined,
          addressLine1: applicantCo.addressLine1?.trim() || undefined,
          addressLine2: applicantCo.addressLine2?.trim() || undefined,
          city: applicantCo.city?.trim() || undefined,
          region: applicantCo.region?.trim() || undefined,
          postalCode: applicantCo.postalCode?.trim() || undefined,
          country: applicantCo.country?.trim() || undefined,
          employerName: applicantCo.employerName?.trim() || undefined,
        });
      }
      await apiFetch<{ data: FinanceApplication }>(
        `/api/deals/${dealId}/applications/${application.id}`,
        { method: "PATCH", body: JSON.stringify({ applicants }) }
      );
      addToast("success", "Application updated");
      fetchApplicationDetail(application.id);
    } catch (e) {
      setApplicationFormError(getApiErrorMessage(e));
      addToast("error", getApiErrorMessage(e));
    } finally {
      setApplicationSaveLoading(false);
    }
  };

  const createSubmission = async () => {
    if (!canWriteHere || !applicationId || !lenderId) return;
    setCreateSubmissionLoading(true);
    setCreateSubmissionError(null);
    try {
      const body: { lenderId: string; reserveEstimateCents?: string } = { lenderId };
      const reserveCents = parseDollarsToCents(reserveEstDollars || "0");
      if (reserveCents) body.reserveEstimateCents = reserveCents;
      await apiFetch<{ data: FinanceSubmission }>(
        `/api/deals/${dealId}/applications/${applicationId}/submissions`,
        { method: "POST", body: JSON.stringify(body) }
      );
      addToast("success", "Submission created");
      setLenderId("");
      setReserveEstDollars("");
      fetchSubmissions(0);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      if (e instanceof HttpError && e.code === "VALIDATION_ERROR") {
        setCreateSubmissionError("Complete Finance tab first (structure required).");
        addToast("error", "Complete Finance tab first (structure required).");
      } else if (e instanceof HttpError && e.code === "CONFLICT") {
        setCreateSubmissionError(msg);
        addToast("error", msg);
      } else {
        setCreateSubmissionError(msg);
        addToast("error", msg);
      }
    } finally {
      setCreateSubmissionLoading(false);
    }
  };

  if (!canReadSubmissions) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-[var(--text-soft)]">
          You don&apos;t have access to lender submissions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[var(--text)]">Lender Submissions</h2>

      {isDealContracted && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3"
          role="alert"
        >
          Deal is contracted. Finance structure is locked; submissions can still be tracked.
        </div>
      )}
      {isDealCanceled && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 text-red-900 px-4 py-3"
          role="alert"
        >
          Deal is canceled. Submissions are canceled and cannot be updated.
        </div>
      )}

      {/* Application section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Finance application</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {applicationsLoading && applications.length === 0 && (
            <Skeleton className="h-24 w-full" />
          )}
          {applicationsError && applications.length === 0 && (
            <ErrorState
              title="Failed to load applications"
              message={applicationsError}
              onRetry={fetchApplications}
            />
          )}
          {!applicationsLoading && !applicationsError && applications.length === 0 && (
            <>
              {canWriteHere ? (
                <EmptyState
                  title="No finance application"
                  description="Create an application to add applicants and submit to lenders."
                  actionLabel="Create Finance Application"
                  onAction={createApplication}
                />
              ) : (
                <p className="text-sm text-[var(--text-soft)]">No finance application yet.</p>
              )}
            </>
          )}
          {application && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Primary applicant — Full name"
                  value={applicantPrimary.fullName ?? ""}
                  onChange={(e) =>
                    setApplicantPrimary((p) => ({ ...p, fullName: e.target.value }))
                  }
                  disabled={!canWriteHere}
                  required
                />
                <Input
                  label="Primary — Email"
                  type="email"
                  value={applicantPrimary.email ?? ""}
                  onChange={(e) =>
                    setApplicantPrimary((p) => ({ ...p, email: e.target.value }))
                  }
                  disabled={!canWriteHere}
                />
                <Input
                  label="Primary — Phone"
                  value={applicantPrimary.phone ?? ""}
                  onChange={(e) =>
                    setApplicantPrimary((p) => ({ ...p, phone: e.target.value }))
                  }
                  disabled={!canWriteHere}
                />
                <Input
                  label="Primary — Address line 1"
                  value={applicantPrimary.addressLine1 ?? ""}
                  onChange={(e) =>
                    setApplicantPrimary((p) => ({ ...p, addressLine1: e.target.value }))
                  }
                  disabled={!canWriteHere}
                />
                <Input
                  label="Primary — City"
                  value={applicantPrimary.city ?? ""}
                  onChange={(e) =>
                    setApplicantPrimary((p) => ({ ...p, city: e.target.value }))
                  }
                  disabled={!canWriteHere}
                />
                <Input
                  label="Primary — Employer (optional)"
                  value={applicantPrimary.employerName ?? ""}
                  onChange={(e) =>
                    setApplicantPrimary((p) => ({ ...p, employerName: e.target.value }))
                  }
                  disabled={!canWriteHere}
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasCoApplicant}
                  onChange={(e) => {
                    setHasCoApplicant(e.target.checked);
                    if (!e.target.checked) setApplicantCo(null);
                    else setApplicantCo({ fullName: "" });
                  }}
                  disabled={!canWriteHere}
                  className="rounded border-[var(--border)]"
                  aria-label="Add co-applicant"
                />
                <span className="text-sm">Co-applicant</span>
              </label>
              {hasCoApplicant && applicantCo && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[var(--border)] pt-4">
                  <Input
                    label="Co-applicant — Full name"
                    value={applicantCo.fullName ?? ""}
                    onChange={(e) =>
                      setApplicantCo((c) => ({ ...c, fullName: e.target.value }))
                    }
                    disabled={!canWriteHere}
                  />
                  <Input
                    label="Co-applicant — Email"
                    type="email"
                    value={applicantCo.email ?? ""}
                    onChange={(e) =>
                      setApplicantCo((c) => ({ ...c, email: e.target.value }))
                    }
                    disabled={!canWriteHere}
                  />
                  <Input
                    label="Co-applicant — Phone"
                    value={applicantCo.phone ?? ""}
                    onChange={(e) =>
                      setApplicantCo((c) => ({ ...c, phone: e.target.value }))
                    }
                    disabled={!canWriteHere}
                  />
                </div>
              )}
              {applicationFormError && (
                <p className="text-sm text-[var(--danger)]" role="alert">
                  {applicationFormError}
                </p>
              )}
              {canWriteHere && (
                <MutationButton onClick={saveApplication} disabled={applicationSaveLoading}>
                  {applicationSaveLoading ? "Saving…" : "Save application"}
                </MutationButton>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Lender select + Create submission */}
      {applicationId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New submission</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canReadLenders && (
              <p className="text-sm text-[var(--text-soft)]">
                You don&apos;t have access to lender directory.
              </p>
            )}
            {canReadLenders && (
              <>
                {lendersLoading ? (
                  <Skeleton className="h-9 w-64" />
                ) : (
                  <div className="flex flex-wrap items-end gap-4">
                    <Select
                      label="Lender"
                      options={[
                        { value: "", label: "Select lender" },
                        ...lenders.map((l) => ({ value: l.id, label: l.name })),
                      ]}
                      value={lenderId}
                      onChange={setLenderId}
                      disabled={!canWriteHere}
                    />
                    <Input
                      label="Reserve estimate ($)"
                      value={reserveEstDollars}
                      onChange={(e) => setReserveEstDollars(e.target.value)}
                      placeholder="0.00"
                      className="w-32"
                      disabled={!canWriteHere}
                    />
                    {canWriteHere && (
                      <MutationButton
                        onClick={createSubmission}
                        disabled={
                          createSubmissionLoading || !lenderId || isDealCanceled
                        }
                      >
                        {createSubmissionLoading ? "Creating…" : "Create submission"}
                      </MutationButton>
                    )}
                  </div>
                )}
                {createSubmissionError && (
                  <p className="text-sm text-[var(--danger)]" role="alert">
                    {createSubmissionError}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submissions table */}
      {applicationId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {submissionsLoading && submissions.length === 0 && (
              <Skeleton className="h-32 w-full" />
            )}
            {submissionsError && submissions.length === 0 && (
              <ErrorState
                title="Failed to load submissions"
                message={submissionsError}
                onRetry={() => fetchSubmissions(0)}
              />
            )}
            {!submissionsLoading && !submissionsError && submissions.length === 0 && (
              <p className="text-sm text-[var(--text-soft)]">No submissions yet.</p>
            )}
            {submissions.length > 0 && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lender</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Funding</TableHead>
                      <TableHead className="text-right">Reserve est.</TableHead>
                      <TableHead aria-label="Actions"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((s) => (
                      <TableRow
                        key={s.id}
                        className={selectedSubmissionId === s.id ? "bg-[var(--muted)]" : ""}
                      >
                        <TableCell className="font-medium">
                          {s.lender?.name ?? s.lenderId.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={submissionStatusToVariant(s.status)}>
                            {s.status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>{s.decisionStatus ?? "—"}</TableCell>
                        <TableCell>
                          {s.submittedAt
                            ? new Date(s.submittedAt).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>{s.fundingStatus}</TableCell>
                        <TableCell className="text-right">
                          {s.reserveEstimateCents
                            ? formatCents(s.reserveEstimateCents)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              setSelectedSubmissionId(
                                selectedSubmissionId === s.id ? null : s.id
                              )
                            }
                            aria-label={selectedSubmissionId === s.id ? "Close detail" : "View detail"}
                          >
                            {selectedSubmissionId === s.id ? "Close" : "View"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {submissionsMeta.total > submissionsMeta.limit && (
                  <Pagination
                    meta={submissionsMeta}
                    onPageChange={(off) => fetchSubmissions(off)}
                    className="mt-4"
                  />
                )}
              </>
            )}

            {selectedSubmissionId && (
              <SubmissionDetailPanel
                dealId={dealId}
                applicationId={applicationId}
                submissionId={selectedSubmissionId}
                submission={submissionDetail}
                loading={submissionDetailLoading}
                error={submissionDetailError}
                onRetry={() => {
                  if (applicationId)
                    apiFetch<{ data: FinanceSubmission }>(
                      `/api/deals/${dealId}/applications/${applicationId}/submissions/${selectedSubmissionId}`
                    ).then((r) => setSubmissionDetail(r.data));
                }}
                canWrite={canWriteHere}
                isDealContracted={isDealContracted}
                canReadDocs={canReadDocs}
                addToast={addToast}
                onSubmissionUpdated={() => {
                  fetchSubmissions(submissionsMeta.offset);
                  if (submissionDetail)
                    setSubmissionDetail((prev) =>
                      prev?.id === selectedSubmissionId ? null : prev
                    );
                  apiFetch<{ data: FinanceSubmission }>(
                    `/api/deals/${dealId}/applications/${applicationId}/submissions/${selectedSubmissionId}`
                  ).then((r) => setSubmissionDetail(r.data));
                }}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SubmissionDetailPanel({
  dealId,
  applicationId,
  submissionId,
  submission,
  loading,
  error,
  onRetry,
  canWrite,
  isDealContracted,
  canReadDocs,
  addToast,
  onSubmissionUpdated,
}: {
  dealId: string;
  applicationId: string;
  submissionId: string;
  submission: FinanceSubmission | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  canWrite: boolean;
  isDealContracted: boolean;
  canReadDocs: boolean;
  addToast: (type: "success" | "error", message: string) => void;
  onSubmissionUpdated: () => void;
}) {
  const [nextStatus, setNextStatus] = React.useState<FinanceSubmissionStatus | "">("");
  const [statusPatchLoading, setStatusPatchLoading] = React.useState(false);
  const [decisionStatus, setDecisionStatus] = React.useState<FinanceDecisionStatus | "">("");
  const [approvedTermMonths, setApprovedTermMonths] = React.useState("");
  const [approvedAprPercent, setApprovedAprPercent] = React.useState("");
  const [approvedPaymentDollars, setApprovedPaymentDollars] = React.useState("");
  const [maxAdvanceDollars, setMaxAdvanceDollars] = React.useState("");
  const [decisionNotes, setDecisionNotes] = React.useState("");
  const [decisionPatchLoading, setDecisionPatchLoading] = React.useState(false);
  const [fundingStatus, setFundingStatus] = React.useState<FinanceFundingStatus>("PENDING");
  const [fundedAmountDollars, setFundedAmountDollars] = React.useState("");
  const [reserveFinalDollars, setReserveFinalDollars] = React.useState("");
  const [fundingPatchLoading, setFundingPatchLoading] = React.useState(false);
  const [stips, setStips] = React.useState<FinanceStipulation[]>([]);
  const [stipsLoading, setStipsLoading] = React.useState(false);
  const [stipsError, setStipsError] = React.useState<string | null>(null);
  const [addStipOpen, setAddStipOpen] = React.useState(false);
  const [newStipType, setNewStipType] = React.useState<FinanceStipulationType>("PAYSTUB");
  const [addStipLoading, setAddStipLoading] = React.useState(false);
  const [linkDocOpen, setLinkDocOpen] = React.useState(false);
  const [linkDocStipId, setLinkDocStipId] = React.useState<string | null>(null);
  const [dealDocs, setDealDocs] = React.useState<DocumentItem[]>([]);
  const [dealDocsLoading, setDealDocsLoading] = React.useState(false);
  const [selectedDocId, setSelectedDocId] = React.useState("");
  const [linkDocPatchLoading, setLinkDocPatchLoading] = React.useState(false);
  const [deleteStipId, setDeleteStipId] = React.useState<string | null>(null);
  const [deleteStipLoading, setDeleteStipLoading] = React.useState(false);

  React.useEffect(() => {
    if (!submission) return;
    setDecisionStatus(submission.decisionStatus ?? "");
    setApprovedTermMonths(submission.approvedTermMonths != null ? String(submission.approvedTermMonths) : "");
    setApprovedAprPercent(
      submission.approvedAprBps != null ? bpsToPercent(submission.approvedAprBps) : ""
    );
    setApprovedPaymentDollars(
      submission.approvedPaymentCents
        ? centsToDollarInput(submission.approvedPaymentCents)
        : ""
    );
    setMaxAdvanceDollars(
      submission.maxAdvanceCents ? centsToDollarInput(submission.maxAdvanceCents) : ""
    );
    setDecisionNotes(submission.decisionNotes ?? "");
    setFundingStatus(submission.fundingStatus);
    setFundedAmountDollars(
      submission.fundedAmountCents ? centsToDollarInput(submission.fundedAmountCents) : ""
    );
    setReserveFinalDollars(
      submission.reserveFinalCents ? centsToDollarInput(submission.reserveFinalCents) : ""
    );
  }, [submission]);

  const fetchStips = React.useCallback(async () => {
    setStipsLoading(true);
    setStipsError(null);
    try {
      const res = await apiFetch<StipulationsListResponse>(
        `/api/deals/${dealId}/applications/${applicationId}/submissions/${submissionId}/stipulations?limit=${STIPS_PAGE_SIZE}&offset=0`
      );
      setStips(res.data ?? []);
    } catch (e) {
      setStipsError(getApiErrorMessage(e));
    } finally {
      setStipsLoading(false);
    }
  }, [dealId, applicationId, submissionId]);

  React.useEffect(() => {
    fetchStips();
  }, [fetchStips]);

  const patchStatus = async () => {
    if (!canWrite || !submission || !nextStatus) return;
    setStatusPatchLoading(true);
    try {
      const updated = await apiFetch<{ data: FinanceSubmission }>(
        `/api/deals/${dealId}/applications/${applicationId}/submissions/${submissionId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      onSubmissionUpdated();
      addToast("success", `Status updated to ${nextStatus}`);
      setNextStatus("");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setStatusPatchLoading(false);
    }
  };

  const patchDecision = async () => {
    if (!canWrite || !submission) return;
    setDecisionPatchLoading(true);
    try {
      const body: {
        decisionStatus?: FinanceDecisionStatus;
        approvedTermMonths?: number;
        approvedAprBps?: number;
        approvedPaymentCents?: string;
        maxAdvanceCents?: string;
        decisionNotes?: string;
      } = {};
      if (decisionStatus) body.decisionStatus = decisionStatus as FinanceDecisionStatus;
      if (approvedTermMonths.trim())
        body.approvedTermMonths = parseInt(approvedTermMonths, 10);
      if (approvedAprPercent.trim()) body.approvedAprBps = percentToBps(approvedAprPercent);
      if (approvedPaymentDollars.trim())
        body.approvedPaymentCents = parseDollarsToCents(approvedPaymentDollars);
      if (maxAdvanceDollars.trim())
        body.maxAdvanceCents = parseDollarsToCents(maxAdvanceDollars);
      if (decisionNotes.trim() !== (submission.decisionNotes ?? ""))
        body.decisionNotes = decisionNotes.trim() || undefined;
      await apiFetch(
        `/api/deals/${dealId}/applications/${applicationId}/submissions/${submissionId}`,
        { method: "PATCH", body: JSON.stringify(body) }
      );
      onSubmissionUpdated();
      addToast("success", "Decision updated");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setDecisionPatchLoading(false);
    }
  };

  const patchFunding = async () => {
    if (!canWrite || !submission) return;
    if (fundingStatus === "FUNDED" && !isDealContracted) {
      addToast("error", "Deal must be CONTRACTED to mark funded.");
      return;
    }
    setFundingPatchLoading(true);
    try {
      const body: {
        fundingStatus: FinanceFundingStatus;
        fundedAmountCents?: string;
        reserveFinalCents?: string;
      } = { fundingStatus };
      if (fundedAmountDollars.trim())
        body.fundedAmountCents = parseDollarsToCents(fundedAmountDollars);
      if (reserveFinalDollars.trim())
        body.reserveFinalCents = parseDollarsToCents(reserveFinalDollars);
      await apiFetch<{ data: FinanceSubmission }>(
        `/api/deals/${dealId}/applications/${applicationId}/submissions/${submissionId}/funding`,
        { method: "PATCH", body: JSON.stringify(body) }
      );
      onSubmissionUpdated();
      addToast("success", "Funding updated");
    } catch (e) {
      if (e instanceof HttpError && e.code === "CONFLICT") {
        addToast("error", "Deal must be CONTRACTED to mark funded.");
      } else {
        addToast("error", getApiErrorMessage(e));
      }
    } finally {
      setFundingPatchLoading(false);
    }
  };

  const addStip = async () => {
    if (!canWrite) return;
    setAddStipLoading(true);
    try {
      await apiFetch(
        `/api/deals/${dealId}/applications/${applicationId}/submissions/${submissionId}/stipulations`,
        {
          method: "POST",
          body: JSON.stringify({ stipType: newStipType, status: "REQUESTED" }),
        }
      );
      addToast("success", "Stipulation added");
      setAddStipOpen(false);
      fetchStips();
      onSubmissionUpdated();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setAddStipLoading(false);
    }
  };

  const patchStipStatus = async (stipId: string, status: FinanceStipulationStatus) => {
    if (!canWrite) return;
    try {
      await apiFetch(
        `/api/deals/${dealId}/applications/${applicationId}/submissions/${submissionId}/stipulations/${stipId}`,
        { method: "PATCH", body: JSON.stringify({ status }) }
      );
      addToast("success", "Stipulation updated");
      fetchStips();
      onSubmissionUpdated();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    }
  };

  const deleteStip = async (stipId: string) => {
    if (!canWrite) return;
    setDeleteStipLoading(true);
    try {
      await apiFetch(
        `/api/deals/${dealId}/applications/${applicationId}/submissions/${submissionId}/stipulations/${stipId}`,
        { method: "DELETE", expectNoContent: true }
      );
      addToast("success", "Stipulation removed");
      setDeleteStipId(null);
      fetchStips();
      onSubmissionUpdated();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setDeleteStipLoading(false);
    }
  };

  const openLinkDoc = (stipId: string) => {
    setLinkDocStipId(stipId);
    setSelectedDocId("");
    setLinkDocOpen(true);
    if (shouldFetchDealDocuments(canReadDocs)) {
      setDealDocsLoading(true);
      apiFetch<DocumentsListResponse>(
        `/api/documents?entityType=DEAL&entityId=${encodeURIComponent(dealId)}&limit=100&offset=0`
      )
        .then((r) => setDealDocs(r.data ?? []))
        .catch(() => setDealDocs([]))
        .finally(() => setDealDocsLoading(false));
    }
  };

  const linkStipDocument = async () => {
    if (!canWrite || !linkDocStipId) return;
    setLinkDocPatchLoading(true);
    try {
      await apiFetch(
        `/api/deals/${dealId}/applications/${applicationId}/submissions/${submissionId}/stipulations/${linkDocStipId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ documentId: selectedDocId || null }),
        }
      );
      addToast("success", "Document linked");
      setLinkDocOpen(false);
      setLinkDocStipId(null);
      fetchStips();
      onSubmissionUpdated();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setLinkDocPatchLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6">
        <ErrorState
          title="Failed to load submission"
          message={error}
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (!submission) return null;

  const nextStatusOptions = SUBMISSION_STATUS_NEXT[submission.status] ?? [];

  return (
    <div className="mt-6 space-y-6 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
      <h3 className="text-base font-semibold text-[var(--text)]">Submission detail</h3>

      {/* Snapshot read-only */}
      <div>
        <h4 className="text-sm font-medium text-[var(--text)] mb-2">Snapshot</h4>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-[var(--text-soft)]">Amount financed</dt>
          <dd>{formatCents(submission.amountFinancedCents)}</dd>
          <dt className="text-[var(--text-soft)]">Term (months)</dt>
          <dd>{submission.termMonths}</dd>
          <dt className="text-[var(--text-soft)]">APR %</dt>
          <dd>{bpsToPercent(submission.aprBps)}%</dd>
          <dt className="text-[var(--text-soft)]">Payment</dt>
          <dd>{formatCents(submission.paymentCents)}</dd>
          <dt className="text-[var(--text-soft)]">Products total</dt>
          <dd>{formatCents(submission.productsTotalCents)}</dd>
          <dt className="text-[var(--text-soft)]">Backend gross</dt>
          <dd>{formatCents(submission.backendGrossCents)}</dd>
        </dl>
      </div>

      {/* Status */}
      <div>
        <h4 className="text-sm font-medium text-[var(--text)] mb-2">Status</h4>
        <p className="text-sm">
          <StatusBadge variant={submissionStatusToVariant(submission.status)}>
            {submission.status}
          </StatusBadge>
        </p>
        {canWrite && nextStatusOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Select
              label="Next status"
              options={[{ value: "", label: "Select…" }, ...nextStatusOptions.map((s) => ({ value: s, label: s }))]}
              value={nextStatus}
              onChange={(v) => setNextStatus(v as FinanceSubmissionStatus)}
            />
            <Button
              size="sm"
              onClick={patchStatus}
              disabled={!nextStatus || statusPatchLoading}
            >
              {statusPatchLoading ? "Updating…" : "Update status"}
            </Button>
          </div>
        )}
      </div>

      {/* Decision */}
      <div>
        <h4 className="text-sm font-medium text-[var(--text)] mb-2">Decision</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Decision status"
            options={[{ value: "", label: "—" }, ...decisionStatusSelectOptions]}
            value={decisionStatus}
            onChange={(v) => setDecisionStatus(v as FinanceDecisionStatus)}
            disabled={!canWrite}
          />
          <Input
            label="Approved term (months)"
            value={approvedTermMonths}
            onChange={(e) => setApprovedTermMonths(e.target.value)}
            disabled={!canWrite}
          />
          <Input
            label="Approved APR (%)"
            value={approvedAprPercent}
            onChange={(e) => setApprovedAprPercent(e.target.value)}
            disabled={!canWrite}
          />
          <Input
            label="Approved payment ($)"
            value={approvedPaymentDollars}
            onChange={(e) => setApprovedPaymentDollars(e.target.value)}
            disabled={!canWrite}
          />
          <Input
            label="Max advance ($)"
            value={maxAdvanceDollars}
            onChange={(e) => setMaxAdvanceDollars(e.target.value)}
            disabled={!canWrite}
          />
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-[var(--text)] mb-1">
              Decision notes
            </label>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              disabled={!canWrite}
              aria-label="Decision notes"
            />
          </div>
        </div>
        {canWrite && (
          <Button
            size="sm"
            className="mt-2"
            onClick={patchDecision}
            disabled={decisionPatchLoading}
          >
            {decisionPatchLoading ? "Saving…" : "Save decision"}
          </Button>
        )}
      </div>

      {/* Stipulations */}
      <div>
        <h4 className="text-sm font-medium text-[var(--text)] mb-2">Stipulations</h4>
        {stipsLoading && stips.length === 0 && <Skeleton className="h-16 w-full" />}
        {stipsError && stips.length === 0 && (
          <p className="text-sm text-[var(--danger)]">{stipsError}</p>
        )}
        {stips.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Document</TableHead>
                {canWrite && <TableHead aria-label="Actions"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {stips.map((stip) => (
                <TableRow key={stip.id}>
                  <TableCell>{stip.stipType}</TableCell>
                  <TableCell>
                    {canWrite ? (
                      <Select
                        options={stipStatusSelectOptions}
                        value={stip.status}
                        onChange={(v) =>
                          patchStipStatus(stip.id, v as FinanceStipulationStatus)
                        }
                        className="max-w-[140px]"
                      />
                    ) : (
                      stip.status
                    )}
                  </TableCell>
                  <TableCell>
                    {stip.documentId ? (
                      canReadDocs ? (
                        <ViewDocumentLink documentId={stip.documentId} />
                      ) : (
                        <span className="text-sm">Linked</span>
                      )
                    ) : canReadDocs ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openLinkDoc(stip.id)}
                        aria-label="Link document"
                      >
                        Link document
                      </Button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  {canWrite && (
                    <TableCell>
                      {canReadDocs && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openLinkDoc(stip.id)}
                          className="mr-1"
                        >
                          Link doc
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setDeleteStipId(stip.id)}
                        aria-label="Delete stipulation"
                      >
                        Delete
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {canWrite && (
          <WriteGuard>
            <Button size="sm" className="mt-2" onClick={() => setAddStipOpen(true)}>
              Add stipulation
            </Button>
          </WriteGuard>
        )}
      </div>

      {/* Funding */}
      <div>
        <h4 className="text-sm font-medium text-[var(--text)] mb-2">Funding</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Funding status"
            options={fundingStatusSelectOptions}
            value={fundingStatus}
            onChange={(v) => setFundingStatus(v as FinanceFundingStatus)}
            disabled={!canWrite}
          />
          <Input
            label="Funded amount ($)"
            value={fundedAmountDollars}
            onChange={(e) => setFundedAmountDollars(e.target.value)}
            disabled={!canWrite}
          />
          <Input
            label="Reserve final ($)"
            value={reserveFinalDollars}
            onChange={(e) => setReserveFinalDollars(e.target.value)}
            disabled={!canWrite}
          />
        </div>
        {canWrite && (
          <MutationButton
            size="sm"
            className="mt-2"
            onClick={patchFunding}
            disabled={fundingPatchLoading}
          >
            {fundingPatchLoading ? "Saving…" : "Save funding"}
          </MutationButton>
        )}
      </div>

      {/* Add stip modal */}
      <Dialog open={addStipOpen} onOpenChange={setAddStipOpen}>
        <DialogHeader>
          <DialogTitle>Add stipulation</DialogTitle>
          <DialogDescription>Add a stipulation with type and status Requested.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select
            label="Type"
            options={stipTypeSelectOptions}
            value={newStipType}
            onChange={(v) => setNewStipType(v as FinanceStipulationType)}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setAddStipOpen(false)} disabled={addStipLoading}>
            Cancel
          </Button>
          <MutationButton onClick={addStip} disabled={addStipLoading}>
            {addStipLoading ? "Adding…" : "Add"}
          </MutationButton>
        </DialogFooter>
      </Dialog>

      {/* Link document modal */}
      <Dialog
        open={linkDocOpen}
        onOpenChange={(open) => !linkDocPatchLoading && setLinkDocOpen(open)}
      >
        <DialogHeader>
          <DialogTitle>Link document</DialogTitle>
          <DialogDescription>
            Select a deal document to link to this stipulation.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {!canReadDocs && (
            <p className="text-sm text-[var(--text-soft)]">No access to documents.</p>
          )}
          {canReadDocs && (
            <>
              {dealDocsLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : dealDocs.length === 0 ? (
                <p className="text-sm text-[var(--text-soft)]">No deal documents.</p>
              ) : (
                <select
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  aria-label="Select document"
                >
                  <option value="">— Select document —</option>
                  {dealDocs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title || d.filename}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => setLinkDocOpen(false)}
            disabled={linkDocPatchLoading}
          >
            Cancel
          </Button>
          <MutationButton
            onClick={linkStipDocument}
            disabled={linkDocPatchLoading || !canReadDocs}
          >
            {linkDocPatchLoading ? "Linking…" : "Link"}
          </MutationButton>
        </DialogFooter>
      </Dialog>

      {/* Delete stip confirm */}
      <Dialog
        open={deleteStipId !== null}
        onOpenChange={(open) => !open && setDeleteStipId(null)}
      >
        <DialogHeader>
          <DialogTitle>Delete stipulation?</DialogTitle>
          <DialogDescription>This will remove the stipulation from the submission.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setDeleteStipId(null)} disabled={deleteStipLoading}>
            Cancel
          </Button>
          <MutationButton
            variant="secondary"
            onClick={() => deleteStipId && deleteStip(deleteStipId)}
            disabled={deleteStipLoading}
          >
            {deleteStipLoading ? "Deleting…" : "Delete"}
          </MutationButton>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
