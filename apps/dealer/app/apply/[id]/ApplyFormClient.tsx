"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client/http";

const STEPS = [
  "Business information",
  "Business owner",
  "Primary contact",
  "Additional locations",
  "Pricing & package interest",
  "Review & submit",
] as const;

type ProfileState = {
  businessInfo: Record<string, unknown>;
  ownerInfo: Record<string, unknown>;
  primaryContact: Record<string, unknown>;
  additionalLocations: unknown;
  pricingPackageInterest: Record<string, unknown>;
  acknowledgments: Record<string, unknown>;
};

function emptyProfile(): ProfileState {
  return {
    businessInfo: {},
    ownerInfo: {},
    primaryContact: {},
    additionalLocations: [],
    pricingPackageInterest: {},
    acknowledgments: {},
  };
}

export function ApplyFormClient({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [app, setApp] = React.useState<{
    applicationId: string;
    status: string;
    source: string;
    ownerEmail: string;
    submittedAt: string | null;
    profile: ProfileState | null;
  } | null>(null);
  const [step, setStep] = React.useState(0);
  const [profile, setProfile] = React.useState<ProfileState>(emptyProfile());
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiFetch<{
      applicationId: string;
      status: string;
      source: string;
      ownerEmail: string;
      submittedAt: string | null;
      profile: ProfileState | null;
    }>(`/api/apply/${applicationId}`)
      .then((data) => {
        if (!cancelled) {
          setApp(data);
          setProfile(
            data.profile
              ? {
                  businessInfo: (data.profile.businessInfo as Record<string, unknown>) ?? {},
                  ownerInfo: (data.profile.ownerInfo as Record<string, unknown>) ?? {},
                  primaryContact: (data.profile.primaryContact as Record<string, unknown>) ?? {},
                  additionalLocations: data.profile.additionalLocations ?? [],
                  pricingPackageInterest:
                    (data.profile.pricingPackageInterest as Record<string, unknown>) ?? {},
                  acknowledgments: (data.profile.acknowledgments as Record<string, unknown>) ?? {},
                }
              : emptyProfile()
          );
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load application.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const saveDraft = React.useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/apply/${applicationId}`, {
        method: "PATCH",
        body: JSON.stringify(profile),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }, [applicationId, profile]);

  const handleNext = async () => {
    setError("");
    await saveDraft();
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      await saveDraft();
      await apiFetch(`/api/apply/${applicationId}/submit`, { method: "POST" });
      router.replace("/apply/success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateSection = <K extends keyof ProfileState>(
    key: K,
    updater: (prev: ProfileState[K]) => ProfileState[K]
  ) => {
    setProfile((p) => ({ ...p, [key]: updater(p[key]) }));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (error && !app) {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <Card className="border-[var(--border)] bg-[var(--surface)]">
          <CardContent className="pt-6">
            <p className="text-[var(--danger-muted-fg)]">{error}</p>
            <Link href="/apply" className="mt-4 inline-block text-sm text-[var(--accent)] hover:underline">
              ← Back to apply
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (app && (app.status === "submitted" || app.status === "under_review" || app.status === "approved" || app.status === "rejected")) {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <Card className="border-[var(--border)] bg-[var(--surface)]">
          <CardHeader>
            <CardTitle>Application submitted</CardTitle>
            <CardDescription>
              Status: {app.status}. {app.submittedAt && `Submitted ${new Date(app.submittedAt).toLocaleDateString()}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/apply" className="text-sm text-[var(--accent)] hover:underline">
              ← Back to apply
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!app) return null;

  const canEdit = app.status === "draft" || app.status === "invited";
  const stepLabel = STEPS[step];

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Dealer application</h1>
          <p className="text-sm text-[var(--text-soft)]">
            Step {step + 1} of {STEPS.length}: {stepLabel}
          </p>
        </div>
        <Link href="/apply" className="text-sm text-[var(--text-soft)] hover:underline">
          Exit
        </Link>
      </div>

      <div className="mb-4 flex gap-1">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded ${
              i <= step ? "bg-[var(--accent)]" : "bg-[var(--border)]"
            }`}
            aria-hidden
          />
        ))}
      </div>

      <Card className="border-[var(--border)] bg-[var(--surface)]">
        <CardHeader>
          <CardTitle className="text-base">{stepLabel}</CardTitle>
          <CardDescription>
            {step === 0 && "Business and contact details."}
            {step === 1 && "Dealership owner information."}
            {step === 2 && "Primary contact for this application."}
            {step === 3 && "Any additional locations."}
            {step === 4 && "Package and product interest."}
            {step === 5 && "Review your answers and submit."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-[var(--danger)] bg-[var(--danger-muted)] px-3 py-2 text-sm text-[var(--danger-muted-fg)]">
              {error}
            </div>
          )}

          {step === 0 && (
            <Step1Business
              data={profile.businessInfo}
              onChange={(d) => updateSection("businessInfo", () => d)}
              disabled={!canEdit}
            />
          )}
          {step === 1 && (
            <Step2Owner
              data={profile.ownerInfo}
              onChange={(d) => updateSection("ownerInfo", () => d)}
              disabled={!canEdit}
            />
          )}
          {step === 2 && (
            <Step3PrimaryContact
              data={profile.primaryContact}
              ownerEmail={app.ownerEmail}
              onChange={(d) => updateSection("primaryContact", () => d)}
              disabled={!canEdit}
            />
          )}
          {step === 3 && (
            <Step4Locations
              data={profile.additionalLocations}
              onChange={(d) => updateSection("additionalLocations", () => d)}
              disabled={!canEdit}
            />
          )}
          {step === 4 && (
            <Step5Pricing
              data={profile.pricingPackageInterest}
              onChange={(d) => updateSection("pricingPackageInterest", () => d)}
              disabled={!canEdit}
            />
          )}
          {step === 5 && (
            <Step6Review
              profile={profile}
              ownerEmail={app.ownerEmail}
              onAckChange={(d) => updateSection("acknowledgments", () => d)}
              disabled={!canEdit}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <div>
              {step > 0 && (
                <Button variant="secondary" onClick={handleBack} disabled={saving}>
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {step < STEPS.length - 1 ? (
                <Button onClick={handleNext} disabled={saving} isLoading={saving}>
                  Save & next
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting || saving} isLoading={submitting}>
                  Submit application
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-xs text-[var(--text-soft)]">
        Save this link to resume later: <span className="font-mono text-[var(--text)]">/apply/{applicationId}</span>
      </p>
    </div>
  );
}

function Step1Business({
  data,
  onChange,
  disabled,
}: {
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  const set = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Input
        label="Business name"
        value={(data.businessName as string) ?? ""}
        onChange={(e) => set("businessName", e.target.value)}
        disabled={disabled}
      />
      <Input
        label="DBA"
        value={(data.dba as string) ?? ""}
        onChange={(e) => set("dba", e.target.value)}
        disabled={disabled}
      />
      <Input
        label="Business phone"
        type="tel"
        value={(data.businessPhone as string) ?? ""}
        onChange={(e) => set("businessPhone", e.target.value)}
        disabled={disabled}
      />
      <Input
        label="Business fax"
        value={(data.businessFax as string) ?? ""}
        onChange={(e) => set("businessFax", e.target.value)}
        disabled={disabled}
      />
      <Input
        label="Business address"
        value={(data.businessAddress as string) ?? ""}
        onChange={(e) => set("businessAddress", e.target.value)}
        disabled={disabled}
        className="sm:col-span-2"
      />
      <Input
        label="Mailing address (if different)"
        value={(data.mailingAddress as string) ?? ""}
        onChange={(e) => set("mailingAddress", e.target.value)}
        disabled={disabled}
        className="sm:col-span-2"
      />
      <Input
        label="Business website"
        value={(data.website as string) ?? ""}
        onChange={(e) => set("website", e.target.value)}
        disabled={disabled}
      />
      <Input
        label="Dealer type"
        value={(data.dealerType as string) ?? ""}
        onChange={(e) => set("dealerType", e.target.value)}
        disabled={disabled}
        placeholder="e.g. Franchise, Independent"
      />
      <Input
        label="Entity type"
        value={(data.entityType as string) ?? ""}
        onChange={(e) => set("entityType", e.target.value)}
        disabled={disabled}
        placeholder="e.g. LLC, Corp"
      />
      <Input
        label="EIN"
        value={(data.ein as string) ?? ""}
        onChange={(e) => set("ein", e.target.value)}
        disabled={disabled}
      />
      <Input
        label="Current DMS provider"
        value={(data.currentDms as string) ?? ""}
        onChange={(e) => set("currentDms", e.target.value)}
        disabled={disabled}
      />
      <Input
        label="Total inventory units"
        value={(data.totalInventoryUnits as string) ?? ""}
        onChange={(e) => set("totalInventoryUnits", e.target.value)}
        disabled={disabled}
      />
      <Input
        label="How did you hear about us?"
        value={(data.howHeard as string) ?? ""}
        onChange={(e) => set("howHeard", e.target.value)}
        disabled={disabled}
        className="sm:col-span-2"
      />
      <Input
        label="Referral code"
        value={(data.referralCode as string) ?? ""}
        onChange={(e) => set("referralCode", e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

function Step2Owner({
  data,
  onChange,
  disabled,
}: {
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  const set = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Input
        label="Full name"
        value={(data.fullName as string) ?? ""}
        onChange={(e) => set("fullName", e.target.value)}
        disabled={disabled}
      />
      <Input
        label="Title"
        value={(data.title as string) ?? ""}
        onChange={(e) => set("title", e.target.value)}
        disabled={disabled}
      />
      <Input
        label="Phone"
        type="tel"
        value={(data.phone as string) ?? ""}
        onChange={(e) => set("phone", e.target.value)}
        disabled={disabled}
      />
      <Input
        label="Email"
        type="email"
        value={(data.email as string) ?? ""}
        onChange={(e) => set("email", e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

function Step3PrimaryContact({
  data,
  ownerEmail,
  onChange,
  disabled,
}: {
  data: Record<string, unknown>;
  ownerEmail: string;
  onChange: (d: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  const set = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const sameAsOwner = (data.sameAsOwner as boolean) ?? false;
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-[var(--text)]">
        <input
          type="checkbox"
          checked={sameAsOwner}
          onChange={(e) => set("sameAsOwner", e.target.checked)}
          disabled={disabled}
          className="rounded border-[var(--border)]"
        />
        Same as business owner
      </label>
      {!sameAsOwner && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Full name"
            value={(data.fullName as string) ?? ""}
            onChange={(e) => set("fullName", e.target.value)}
            disabled={disabled}
          />
          <Input
            label="Title"
            value={(data.title as string) ?? ""}
            onChange={(e) => set("title", e.target.value)}
            disabled={disabled}
          />
          <Input
            label="Phone"
            type="tel"
            value={(data.phone as string) ?? ""}
            onChange={(e) => set("phone", e.target.value)}
            disabled={disabled}
          />
          <Input
            label="Email"
            type="email"
            value={(data.email as string) ?? ownerEmail}
            onChange={(e) => set("email", e.target.value)}
            disabled={disabled}
          />
        </div>
      )}
      <label className="flex items-center gap-2 text-sm text-[var(--text)]">
        <input
          type="checkbox"
          checked={(data.preferSpanish as boolean) ?? false}
          onChange={(e) => set("preferSpanish", e.target.checked)}
          disabled={disabled}
          className="rounded border-[var(--border)]"
        />
        Prefer Spanish-speaking representative
      </label>
    </div>
  );
}

type LocationEntry = {
  dealerName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  fax?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
};

function Step4Locations({
  data,
  onChange,
  disabled,
}: {
  data: unknown;
  onChange: (d: unknown) => void;
  disabled: boolean;
}) {
  const list = Array.isArray(data) ? (data as LocationEntry[]) : [];
  const setList = (next: LocationEntry[]) => onChange(next);
  const update = (i: number, k: keyof LocationEntry, v: string) => {
    const copy = [...list];
    if (!copy[i]) copy[i] = {};
    copy[i] = { ...copy[i], [k]: v };
    setList(copy);
  };
  const add = () => setList([...list, {}]);
  const remove = (i: number) => setList(list.filter((_, j) => j !== i));
  return (
    <div className="space-y-4">
      {list.map((loc, i) => (
        <Card key={i} className="border-[var(--border)] bg-[var(--surface-2)]">
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--text)]">Location {i + 1}</span>
              {!disabled && (
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
                  Remove
                </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Dealer name" value={loc.dealerName ?? ""} onChange={(e) => update(i, "dealerName", e.target.value)} disabled={disabled} />
              <Input label="First name" value={loc.firstName ?? ""} onChange={(e) => update(i, "firstName", e.target.value)} disabled={disabled} />
              <Input label="Last name" value={loc.lastName ?? ""} onChange={(e) => update(i, "lastName", e.target.value)} disabled={disabled} />
              <Input label="Phone" value={loc.phone ?? ""} onChange={(e) => update(i, "phone", e.target.value)} disabled={disabled} />
              <Input label="Fax" value={loc.fax ?? ""} onChange={(e) => update(i, "fax", e.target.value)} disabled={disabled} />
              <Input label="Email" value={loc.email ?? ""} onChange={(e) => update(i, "email", e.target.value)} disabled={disabled} />
              <Input label="Address" value={loc.address ?? ""} onChange={(e) => update(i, "address", e.target.value)} disabled={disabled} className="sm:col-span-2" />
              <Input label="City" value={loc.city ?? ""} onChange={(e) => update(i, "city", e.target.value)} disabled={disabled} />
              <Input label="State" value={loc.state ?? ""} onChange={(e) => update(i, "state", e.target.value)} disabled={disabled} />
              <Input label="ZIP" value={loc.zip ?? ""} onChange={(e) => update(i, "zip", e.target.value)} disabled={disabled} />
            </div>
          </CardContent>
        </Card>
      ))}
      {!disabled && (
        <Button type="button" variant="outline" onClick={add}>
          Add location
        </Button>
      )}
    </div>
  );
}

function Step5Pricing({
  data,
  onChange,
  disabled,
}: {
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  const set = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-3">
      <Input
        label="Bundle preference"
        value={(data.bundlePreference as string) ?? ""}
        onChange={(e) => set("bundlePreference", e.target.value)}
        disabled={disabled}
        placeholder="Pre-bundle or build-your-own"
      />
      <Input
        label="Selected providers / products"
        value={(data.selectedProviders as string) ?? ""}
        onChange={(e) => set("selectedProviders", e.target.value)}
        disabled={disabled}
        placeholder="Comma-separated or notes"
      />
      <label className="block text-sm font-medium text-[var(--text)]">Package / commercial interest</label>
      <textarea
        className="min-h-[80px] w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm placeholder:text-[var(--text-soft)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        value={(data.packageInterest as string) ?? ""}
        onChange={(e) => set("packageInterest", e.target.value)}
        disabled={disabled}
        placeholder="Describe package or commercial selection interest"
      />
    </div>
  );
}

function Step6Review({
  profile,
  ownerEmail,
  onAckChange,
  disabled,
}: {
  profile: ProfileState;
  ownerEmail: string;
  onAckChange: (d: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  const ack = profile.acknowledgments;
  const set = (k: string, v: unknown) => onAckChange({ ...ack, [k]: v });
  const biz = profile.businessInfo as Record<string, unknown>;
  const owner = profile.ownerInfo as Record<string, unknown>;
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm">
        <p><span className="text-[var(--text-soft)]">Business:</span> {String(biz.businessName ?? "—")}</p>
        <p><span className="text-[var(--text-soft)]">Owner:</span> {String(owner.fullName ?? "—")} · {String(owner.email ?? ownerEmail)}</p>
      </div>
      <label className="flex items-start gap-2 text-sm text-[var(--text)]">
        <input
          type="checkbox"
          checked={(ack.confirmAccurate as boolean) ?? false}
          onChange={(e) => set("confirmAccurate", e.target.checked)}
          disabled={disabled}
          className="mt-0.5 rounded border-[var(--border)]"
        />
        <span>I confirm the information provided is accurate and complete.</span>
      </label>
      <label className="flex items-start gap-2 text-sm text-[var(--text)]">
        <input
          type="checkbox"
          checked={(ack.acceptTerms as boolean) ?? false}
          onChange={(e) => set("acceptTerms", e.target.checked)}
          disabled={disabled}
          className="mt-0.5 rounded border-[var(--border)]"
        />
        <span>I accept the terms and conditions for this application.</span>
      </label>
    </div>
  );
}
