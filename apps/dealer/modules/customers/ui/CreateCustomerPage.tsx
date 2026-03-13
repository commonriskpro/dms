"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiFetch, getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { useWriteDisabled } from "@/components/write-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { modalDepthChipSubtle, modalDepthFooterSubtle, modalDepthSurfaceStrong, modalFieldTone } from "@/lib/ui/modal-depth";
import { customerDetailPath } from "@/lib/routes/detail-paths";
import { centsToDollarInput, parseDollarsToCents } from "@/lib/money";
import type {
  CustomerDetail,
  CustomerEmailInput,
  CustomerPhoneInput,
  CustomerStatus,
} from "@/lib/types/customers";
import { CUSTOMER_STATUS_OPTIONS } from "@/lib/types/customers";

type MemberOption = { id: string; fullName: string | null; email: string };
type ContactRow = { kind: string; value: string };

const statusOptions: SelectOption[] = CUSTOMER_STATUS_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

const genderOptions: SelectOption[] = [
  { value: "", label: "Select" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
  { value: "other", label: "Other" },
];

const idTypeOptions: SelectOption[] = [
  { value: "", label: "Select" },
  { value: "driver_license", label: "Driver license" },
  { value: "state_id", label: "State ID" },
  { value: "passport", label: "Passport" },
  { value: "military_id", label: "Military ID" },
];

const leadTypeOptions: SelectOption[] = [
  { value: "", label: "Select" },
  { value: "internet", label: "Internet" },
  { value: "walk_in", label: "Walk-in" },
  { value: "phone_up", label: "Phone up" },
  { value: "referral", label: "Referral" },
];

const customerClassOptions = [
  { value: "individual", label: "Individual" },
  { value: "business", label: "Business" },
] as const;

const inputTone = cn("h-11 rounded-xl px-4 text-sm", modalFieldTone);
const sectionPanel = cn("rounded-[24px] p-4 sm:p-5", modalDepthSurfaceStrong);

function normalizeContactRows<T extends ContactRow>(rows: T[]): T[] {
  const filtered = rows
    .map((row) => ({ ...row, kind: row.kind.trim(), value: row.value.trim() }))
    .filter((row) => row.value.length > 0);
  return filtered;
}

function detailValue(value: string | null | undefined) {
  return value?.trim() ? value.trim() : "Not set";
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeFreeText(value: string) {
  return value.replace(/\s+/g, " ").replace(/[^\x20-\x7E]/g, "");
}

function sanitizeEmailInput(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function formatPhoneInput(value: string) {
  const digits = normalizeDigits(value).slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function sanitizeStateInput(value: string) {
  return value.replace(/[^a-zA-Z\s]/g, "").toUpperCase().slice(0, 32);
}

function sanitizePostalCodeInput(value: string) {
  const cleaned = value.replace(/[^\d-]/g, "").slice(0, 10);
  if (cleaned.length > 5 && !cleaned.includes("-")) {
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 9)}`;
  }
  return cleaned;
}

function sanitizeIdNumberInput(value: string) {
  return value.replace(/[^a-zA-Z0-9 -]/g, "").toUpperCase().slice(0, 128);
}

function sanitizeMoneyInput(value: string) {
  const cleaned = value.replace(/[^0-9.,$]/g, "");
  const parts = cleaned.replace(/,/g, "").split(".");
  if (parts.length > 2) return value;
  if (parts.length === 2) {
    return `${parts[0]}.${parts[1].slice(0, 2)}`;
  }
  return cleaned;
}

function composeCustomerName(parts: {
  firstName: string;
  middleName: string;
  lastName: string;
  nameSuffix: string;
}) {
  return [parts.firstName, parts.middleName, parts.lastName, parts.nameSuffix]
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)
    .join(" ");
}

function formatSsnInput(value: string) {
  const compact = value.replace(/[^\d*]/g, "").slice(0, 9);
  if (compact.length <= 3) return compact;
  if (compact.length <= 5) return `${compact.slice(0, 3)}-${compact.slice(3)}`;
  return `${compact.slice(0, 3)}-${compact.slice(3, 5)}-${compact.slice(5)}`;
}

function DraftBadge() {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200", modalDepthChipSubtle)}>
      Draft
    </span>
  );
}

export function CreateCustomerPage({ mode = "page" }: { mode?: "page" | "modal" }) {
  const isModal = mode === "modal";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const { hasPermission } = useSession();
  const { disabled: writeDisabled } = useWriteDisabled();
  const canWrite = hasPermission("customers.write");

  const draftId = searchParams.get("draft");

  const [assignedOptions, setAssignedOptions] = React.useState<SelectOption[]>([]);
  const [loadingDraft, setLoadingDraft] = React.useState(false);
  const [draftCustomerId, setDraftCustomerId] = React.useState<string | null>(draftId);
  const [isDraftRecord, setIsDraftRecord] = React.useState(Boolean(draftId));
  const [submitLoading, setSubmitLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const [name, setName] = React.useState("");
  const [customerClass, setCustomerClass] = React.useState("individual");
  const [firstName, setFirstName] = React.useState("");
  const [middleName, setMiddleName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [nameSuffix, setNameSuffix] = React.useState("");
  const [county, setCounty] = React.useState("");
  const [isActiveMilitary, setIsActiveMilitary] = React.useState(false);
  const [gender, setGender] = React.useState("");
  const [ssn, setSsn] = React.useState("");
  const [dob, setDob] = React.useState("");
  const [idType, setIdType] = React.useState("");
  const [idState, setIdState] = React.useState("");
  const [idNumber, setIdNumber] = React.useState("");
  const [idIssuedDate, setIdIssuedDate] = React.useState("");
  const [idExpirationDate, setIdExpirationDate] = React.useState("");
  const [leadType, setLeadType] = React.useState("");
  const [status, setStatus] = React.useState<CustomerStatus>("LEAD");
  const [leadSource, setLeadSource] = React.useState("");
  const [leadCampaign, setLeadCampaign] = React.useState("");
  const [leadMedium, setLeadMedium] = React.useState("");
  const [assignedTo, setAssignedTo] = React.useState("");
  const [bdcRepId, setBdcRepId] = React.useState("");
  const [cashDownDollars, setCashDownDollars] = React.useState("");
  const [isInShowroom, setIsInShowroom] = React.useState(false);
  const [tagsInput, setTagsInput] = React.useState("");
  const [addressLine1, setAddressLine1] = React.useState("");
  const [addressLine2, setAddressLine2] = React.useState("");
  const [city, setCity] = React.useState("");
  const [region, setRegion] = React.useState("");
  const [postalCode, setPostalCode] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [phones, setPhones] = React.useState<ContactRow[]>([{ kind: "", value: "" }]);
  const [emails, setEmails] = React.useState<ContactRow[]>([{ kind: "", value: "" }]);

  const assignedSelectOptions = React.useMemo<SelectOption[]>(
    () => [{ value: "", label: "Unassigned" }, ...assignedOptions],
    [assignedOptions]
  );

  const primaryEmail = emails[0]?.value?.trim() ?? "";
  const cellPhone = React.useMemo(() => phones.find((phone) => (phone.kind ?? "").trim().toLowerCase() === "cell")?.value ?? "", [phones]);
  const homePhone = React.useMemo(() => phones.find((phone) => (phone.kind ?? "").trim().toLowerCase() === "home")?.value ?? "", [phones]);
  const workPhone = React.useMemo(() => phones.find((phone) => (phone.kind ?? "").trim().toLowerCase() === "work")?.value ?? "", [phones]);
  const displayName = React.useMemo(
    () => composeCustomerName({ firstName, middleName, lastName, nameSuffix }),
    [firstName, middleName, lastName, nameSuffix]
  );
  const completedCoreFields = [displayName.trim(), cellPhone.trim(), primaryEmail, assignedTo.trim()].filter(Boolean).length;
  const footerMetrics = [
    `${completedCoreFields}/4 core fields`,
    cellPhone ? "Cell ready" : "No cell",
    primaryEmail ? "Email ready" : "No email",
    assignedTo ? "Assigned" : "Unassigned",
  ];

  const resetForm = React.useCallback(() => {
    setName("");
    setCustomerClass("individual");
    setFirstName("");
    setMiddleName("");
    setLastName("");
    setNameSuffix("");
    setCounty("");
    setIsActiveMilitary(false);
    setGender("");
    setSsn("");
    setDob("");
    setIdType("");
    setIdState("");
    setIdNumber("");
    setIdIssuedDate("");
    setIdExpirationDate("");
    setLeadType("");
    setStatus("LEAD");
    setLeadSource("");
    setLeadCampaign("");
    setLeadMedium("");
    setAssignedTo("");
    setBdcRepId("");
    setCashDownDollars("");
    setIsInShowroom(false);
    setTagsInput("");
    setAddressLine1("");
    setAddressLine2("");
    setCity("");
    setRegion("");
    setPostalCode("");
    setCountry("");
    setPhones([{ kind: "", value: "" }]);
    setEmails([{ kind: "", value: "" }]);
    setErrors({});
    setDraftCustomerId(null);
    setIsDraftRecord(false);
  }, []);

  const hydrateForm = React.useCallback((customer: CustomerDetail) => {
    setName(customer.name);
    setCustomerClass(customer.customerClass ?? "individual");
    setFirstName(customer.firstName ?? "");
    setMiddleName(customer.middleName ?? "");
    setLastName(customer.lastName ?? "");
    setNameSuffix(customer.nameSuffix ?? "");
    setCounty(customer.county ?? "");
    setIsActiveMilitary(customer.isActiveMilitary ?? false);
    setGender(customer.gender ?? "");
    setSsn(customer.ssnMasked ?? "");
    setDob(customer.dob ?? "");
    setIdType(customer.idType ?? "");
    setIdState(customer.idState ?? "");
    setIdNumber(customer.idNumber ?? "");
    setIdIssuedDate(customer.idIssuedDate ?? "");
    setIdExpirationDate(customer.idExpirationDate ?? "");
    setLeadType(customer.leadType ?? "");
    setStatus((customer.status as CustomerStatus) ?? "LEAD");
    setLeadSource(customer.leadSource ?? "");
    setLeadCampaign(customer.leadCampaign ?? "");
    setLeadMedium(customer.leadMedium ?? "");
    setAssignedTo(customer.assignedTo ?? "");
    setBdcRepId(customer.bdcRepId ?? "");
    setCashDownDollars(customer.cashDownCents ? centsToDollarInput(customer.cashDownCents) : "");
    setIsInShowroom(customer.isInShowroom ?? false);
    setTagsInput(customer.tags.join(", "));
    setAddressLine1(customer.addressLine1 ?? "");
    setAddressLine2(customer.addressLine2 ?? "");
    setCity(customer.city ?? "");
    setRegion(customer.region ?? "");
    setPostalCode(customer.postalCode ?? "");
    setCountry(customer.country ?? "");
    setPhones(
      customer.phones.length
        ? customer.phones
            .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
            .map((phone) => ({ kind: phone.kind ?? "", value: phone.value }))
        : [{ kind: "", value: "" }]
    );
    setEmails(
      customer.emails.length
        ? customer.emails
            .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
            .map((email) => ({ kind: email.kind ?? "", value: email.value }))
        : [{ kind: "", value: "" }]
    );
    setDraftCustomerId(customer.id);
    setIsDraftRecord(customer.isDraft);
    setErrors({});
  }, []);

  React.useEffect(() => {
    if (!hasPermission("admin.memberships.read")) return;
    apiFetch<{ data: { user: MemberOption }[] }>("/api/admin/memberships?limit=100")
      .then((res) => {
        const seen = new Set<string>();
        const list: SelectOption[] = [];
        for (const membership of res.data ?? []) {
          const user = membership.user;
          if (user && !seen.has(user.id)) {
            seen.add(user.id);
            list.push({
              value: user.id,
              label: user.fullName ?? user.email ?? user.id,
            });
          }
        }
        setAssignedOptions(list);
      })
      .catch(() => setAssignedOptions([]));
  }, [hasPermission]);

  React.useEffect(() => {
    setDraftCustomerId(draftId);
    if (!draftId) {
      setIsDraftRecord(false);
      return;
    }
    setLoadingDraft(true);
    apiFetch<{ data: CustomerDetail }>(`/api/customers/${draftId}`)
      .then((response) => {
        if (!response.data.isDraft) {
          router.replace(customerDetailPath(response.data.id));
          return;
        }
        hydrateForm(response.data);
      })
      .catch((error) => {
        addToast("error", getApiErrorMessage(error));
        router.replace(pathname);
      })
      .finally(() => setLoadingDraft(false));
  }, [addToast, draftId, hydrateForm, pathname, router]);

  const setPhoneByKind = React.useCallback((phoneKind: "cell" | "home" | "work", value: string) => {
    const formattedValue = formatPhoneInput(value);
    setPhones((current) => {
      const matchIndex = current.findIndex((row) => (row.kind ?? "").trim().toLowerCase() === phoneKind);
      if (matchIndex >= 0) {
        const next = [...current];
        next[matchIndex] = { ...next[matchIndex], kind: phoneKind, value: formattedValue };
        return next;
      }
      return [...current, { kind: phoneKind, value: formattedValue }];
    });
  }, []);

  const setPrimaryEmailValue = React.useCallback((value: string) => {
    const sanitizedValue = sanitizeEmailInput(value);
    setEmails((current) => {
      if (current.length === 0) return [{ kind: "primary", value: sanitizedValue }];
      const next = [...current];
      next[0] = { ...next[0], kind: next[0]?.kind || "primary", value: sanitizedValue };
      return next;
    });
  }, []);

  const buildPayload = React.useCallback(
    (draft: boolean) => {
      const nextErrors: Record<string, string> = {};
      if (!displayName.trim()) nextErrors.name = "First or last name is required";
      if (!draft && !cellPhone && !primaryEmail) {
        nextErrors.contact = "Add at least a phone or email before creating the customer.";
      }
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return null;

      const tags = tagsInput
        .split(/,\s*/)
        .map((tag) => tag.trim())
        .filter(Boolean);

      const normalizedPhones = normalizeContactRows(phones).map<CustomerPhoneInput>((row, index) => ({
        kind: row.kind || undefined,
        value: row.value,
        isPrimary: index === 0,
      }));
      const normalizedEmails = normalizeContactRows(emails).map<CustomerEmailInput>((row, index) => ({
        kind: row.kind || undefined,
        value: row.value,
        isPrimary: index === 0,
      }));

      const sanitizedSsn = normalizeDigits(ssn);
      const cashDownCents = parseDollarsToCents(cashDownDollars);

      return {
        name: displayName,
        customerClass: customerClass || undefined,
        firstName: normalizeWhitespace(firstName) || undefined,
        middleName: normalizeWhitespace(middleName) || undefined,
        lastName: normalizeWhitespace(lastName) || undefined,
        nameSuffix: normalizeWhitespace(nameSuffix) || undefined,
        county: normalizeWhitespace(county) || undefined,
        isActiveMilitary,
        isDraft: draft,
        gender: gender.trim() || undefined,
        dob: dob || undefined,
        ssn: sanitizedSsn && !ssn.includes("*") ? sanitizedSsn : undefined,
        status,
        leadSource: normalizeWhitespace(leadSource) || undefined,
        leadType: leadType.trim() || undefined,
        leadCampaign: normalizeWhitespace(leadCampaign) || undefined,
        leadMedium: normalizeWhitespace(leadMedium) || undefined,
        assignedTo: assignedTo || undefined,
        bdcRepId: bdcRepId || undefined,
        idType: idType.trim() || undefined,
        idState: sanitizeStateInput(idState) || undefined,
        idNumber: sanitizeIdNumberInput(idNumber) || undefined,
        idIssuedDate: idIssuedDate || undefined,
        idExpirationDate: idExpirationDate || undefined,
        cashDownCents: cashDownCents || undefined,
        isInShowroom,
        tags: tags.length ? tags : undefined,
        addressLine1: normalizeWhitespace(addressLine1) || undefined,
        addressLine2: normalizeWhitespace(addressLine2) || undefined,
        city: normalizeWhitespace(city) || undefined,
        region: sanitizeFreeText(region).trim() || undefined,
        postalCode: sanitizePostalCodeInput(postalCode) || undefined,
        country: sanitizeFreeText(country).trim() || undefined,
        phones: normalizedPhones.length ? normalizedPhones : undefined,
        emails: normalizedEmails.length ? normalizedEmails : undefined,
      };
    },
    [
      addressLine1,
      addressLine2,
      assignedTo,
      bdcRepId,
      city,
      county,
      country,
      customerClass,
      cashDownDollars,
      cellPhone,
      dob,
      displayName,
      emails,
      firstName,
      gender,
      isActiveMilitary,
      idExpirationDate,
      idIssuedDate,
      idNumber,
      idState,
      idType,
      isInShowroom,
      lastName,
      leadCampaign,
      leadType,
      leadMedium,
      leadSource,
      middleName,
      nameSuffix,
      phones,
      postalCode,
      primaryEmail,
      region,
      ssn,
      status,
      tagsInput,
    ]
  );

  const persistCustomer = React.useCallback(
    async (draft: boolean) => {
      const payload = buildPayload(draft);
      if (!payload) return null;
      setSubmitLoading(true);
      try {
        const response = draftCustomerId
          ? await apiFetch<{ data: CustomerDetail }>(`/api/customers/${draftCustomerId}`, {
              method: "PATCH",
              body: JSON.stringify(payload),
            })
          : await apiFetch<{ data: CustomerDetail }>("/api/customers", {
              method: "POST",
              body: JSON.stringify(payload),
            });
        hydrateForm(response.data);
        return response.data;
      } catch (error) {
        const message = getApiErrorMessage(error);
        setErrors((current) => ({ ...current, submit: message }));
        addToast("error", message);
        return null;
      } finally {
        setSubmitLoading(false);
      }
    },
    [addToast, buildPayload, draftCustomerId, hydrateForm]
  );

  const handleSaveDraft = React.useCallback(async () => {
    const saved = await persistCustomer(true);
    if (!saved) return;
    setIsDraftRecord(true);
    addToast("success", "Customer draft saved");
    router.replace(`${pathname}?draft=${saved.id}`, { scroll: false });
  }, [addToast, pathname, persistCustomer, router]);

  const handleCreateCustomer = React.useCallback(async () => {
    const saved = await persistCustomer(false);
    if (!saved) return;
    addToast("success", "Customer created");
    router.push(customerDetailPath(saved.id));
  }, [addToast, persistCustomer, router]);

  const handleSaveAndAddAnother = React.useCallback(async () => {
    const saved = await persistCustomer(false);
    if (!saved) return;
    addToast("success", "Customer created");
    resetForm();
    router.replace(pathname, { scroll: false });
  }, [addToast, pathname, persistCustomer, resetForm, router]);

  const handleCancel = React.useCallback(() => {
    if (isModal) {
      router.back();
      return;
    }
    router.push("/customers");
  }, [isModal, router]);

  if (!canWrite) {
    return (
      <div className="space-y-6">
        {!isModal && (
          <Link href="/customers" className="text-sm text-[var(--accent)] hover:underline">
            ← Back to customers
          </Link>
        )}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
          <p className="text-[var(--text-soft)]">You don’t have permission to create customers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-full flex-col", isModal ? "bg-[var(--surface)]" : "space-y-6")}>
      {!isModal && (
        <div className="space-y-2">
          <Link href="/customers" className="text-sm text-[var(--accent)] hover:underline">
            ← Back to customers
          </Link>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]/85">Step 1</p>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[var(--text)]">New customer</h1>
            <p className="text-sm leading-6 text-[var(--muted-text)]">
              Start with core identity and contact details, then add lead context and profile information.
            </p>
          </div>
        </div>
      )}

      <div className={cn("flex-1", isModal ? "flex min-h-full flex-col" : "space-y-4")}>
        {isModal && (
          <div className="px-5 pb-3 pt-5 sm:px-6 sm:pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]/85">Step 1</p>
                <div className="flex items-center gap-3">
                  <h1 className="text-[1.85rem] font-semibold tracking-[-0.03em] text-[var(--text)]">Customer identity</h1>
                  {isDraftRecord ? <DraftBadge /> : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]/86", modalDepthChipSubtle)}>
                  {status}
                </span>
                {isDraftRecord ? <DraftBadge /> : null}
              </div>
            </div>
          </div>
        )}

        <div className={cn("flex-1", isModal ? "overflow-auto px-5 py-4 sm:px-6" : "")}>
          <div className={cn("space-y-4", isModal ? "space-y-3.5" : "space-y-5")}>
            <section className="space-y-2.5">
              <div className={cn(isModal ? "hidden" : "space-y-1")}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]/85">Step 1</p>
                <h2 className="text-[1.65rem] font-semibold tracking-[-0.03em] text-[var(--text)]">Customer identity</h2>
              </div>
              <div className={sectionPanel}>
                <div className="space-y-3">
                  <div className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-end">
                    <div className="space-y-3">
                      <p className="text-[13px] font-medium text-[var(--text-soft)]/88">Customer type</p>
                      <div className="flex flex-wrap gap-2">
                        {customerClassOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setCustomerClass(option.value)}
                            className={cn(
                              "rounded-xl border px-4 py-2 text-sm transition",
                              customerClass === option.value
                                ? "border-[var(--accent)] bg-[color:rgba(59,130,246,0.16)] text-[var(--text)]"
                                : "border-[var(--border)] text-[var(--text-soft)]"
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.6fr_220px_220px]">
                      <div>
                        <Input
                          label="First name"
                          value={firstName}
                          onChange={(event) => setFirstName(sanitizeFreeText(event.target.value))}
                          className={inputTone}
                          labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                          error={errors.name}
                        />
                      </div>
                      <div>
                        <Input
                          label="Middle name"
                          value={middleName}
                          onChange={(event) => setMiddleName(sanitizeFreeText(event.target.value))}
                          className={inputTone}
                          labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                        />
                      </div>
                      <div>
                        <Input
                          label="Last name"
                          value={lastName}
                          onChange={(event) => setLastName(sanitizeFreeText(event.target.value))}
                          className={inputTone}
                          labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                        />
                      </div>
                      <div>
                        <Select
                          label="Gender"
                          options={genderOptions}
                          value={gender}
                          onChange={setGender}
                          className={cn("h-11 rounded-xl text-sm text-[var(--text)]", modalFieldTone)}
                        />
                      </div>
                      <div>
                        <Input
                          label="Date of birth"
                          type="date"
                          value={dob}
                          onChange={(event) => setDob(event.target.value)}
                          className={inputTone}
                          labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-10">
                    <div className="xl:col-span-2">
                      <Input
                        label="SSN"
                        value={ssn}
                        onChange={(event) => setSsn(formatSsnInput(event.target.value))}
                        inputMode="numeric"
                        placeholder="123-45-6789"
                        className={inputTone}
                        labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                      />
                    </div>
                    <div className="xl:col-span-2">
                      <Select
                        label="ID type"
                        options={idTypeOptions}
                        value={idType}
                        onChange={setIdType}
                        className={cn("h-11 rounded-xl text-sm text-[var(--text)]", modalFieldTone)}
                      />
                    </div>
                    <div className="xl:col-span-2">
                      <Input
                        label="ID no."
                        value={idNumber}
                        onChange={(event) => setIdNumber(sanitizeIdNumberInput(event.target.value))}
                        className={inputTone}
                        labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                      />
                    </div>
                    <div className="xl:col-span-2">
                      <Input
                        label="ID state"
                        value={idState}
                        onChange={(event) => setIdState(sanitizeStateInput(event.target.value))}
                        className={inputTone}
                        labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                      />
                    </div>
                    <div className="xl:col-span-2">
                      <Input
                        label="County"
                        value={county}
                        onChange={(event) => setCounty(sanitizeFreeText(event.target.value))}
                        className={inputTone}
                        labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                    <Input
                      label="Issued date"
                      type="date"
                      value={idIssuedDate}
                      onChange={(event) => setIdIssuedDate(event.target.value)}
                      className={inputTone}
                      labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                    />
                    <Input
                      label="Expiration date"
                      type="date"
                      value={idExpirationDate}
                      onChange={(event) => setIdExpirationDate(event.target.value)}
                      className={inputTone}
                      labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                    />
                    <Input
                      label="Cell phone"
                      value={cellPhone}
                      onChange={(event) => setPhoneByKind("cell", event.target.value)}
                      className={inputTone}
                      labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                    />
                    <Input
                      label="Home phone"
                      value={homePhone}
                      onChange={(event) => setPhoneByKind("home", event.target.value)}
                      className={inputTone}
                      labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                    />
                    <Input
                      label="Work phone"
                      value={workPhone}
                      onChange={(event) => setPhoneByKind("work", event.target.value)}
                      className={inputTone}
                      labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                    />
                    <div className="xl:col-span-2">
                      <Input
                        label="Email"
                        type="email"
                        value={emails[0]?.value ?? ""}
                        onChange={(event) => setPrimaryEmailValue(event.target.value)}
                        className={inputTone}
                        labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                      />
                    </div>
                  </div>

                  {errors.contact ? (
                    <p className="text-sm text-[var(--danger)]">{errors.contact}</p>
                  ) : null}
                </div>
              </div>
            </section>

            <div className={cn("grid", isModal ? "gap-3" : "gap-4", "xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]")}>
              <section className={cn("space-y-2.5", isModal && "space-y-2")}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]/85">Step 2</p>
                {!isModal && <h2 className="text-[1.65rem] font-semibold tracking-[-0.03em] text-[var(--text)]">Lead context</h2>}
                <div className={sectionPanel}>
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                      <Select
                        label="Lead type"
                        options={leadTypeOptions}
                        value={leadType}
                        onChange={setLeadType}
                        className={cn("h-11 rounded-xl text-sm text-[var(--text)]", modalFieldTone)}
                      />
                      <Input
                        label="Lead source"
                        value={leadSource}
                        onChange={(event) => setLeadSource(sanitizeFreeText(event.target.value))}
                        className={inputTone}
                        labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                      <Select
                        label="Sales rep"
                        options={assignedSelectOptions}
                        value={assignedTo}
                        onChange={setAssignedTo}
                        className={cn("h-11 rounded-xl text-sm text-[var(--text)]", modalFieldTone)}
                      />
                      <Select
                        label="BDC rep"
                        options={assignedSelectOptions}
                        value={bdcRepId}
                        onChange={setBdcRepId}
                        className={cn("h-11 rounded-xl text-sm text-[var(--text)]", modalFieldTone)}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <Input
                        label="Campaign"
                        value={leadCampaign}
                        onChange={(event) => setLeadCampaign(sanitizeFreeText(event.target.value))}
                        className={inputTone}
                        labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                      />
                      <Input
                        label="Medium"
                        value={leadMedium}
                        onChange={(event) => setLeadMedium(sanitizeFreeText(event.target.value))}
                        className={inputTone}
                        labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                      />
                      <Input
                        label="Cash down"
                        value={cashDownDollars}
                        onChange={(event) => setCashDownDollars(sanitizeMoneyInput(event.target.value))}
                        className={inputTone}
                        labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                      <Select
                        label="Status"
                        options={statusOptions}
                        value={status}
                        onChange={(value) => setStatus(value as CustomerStatus)}
                        className={cn("h-11 rounded-xl text-sm text-[var(--text)]", modalFieldTone)}
                      />
                      <Input
                        label="Tags"
                        placeholder="VIP, referral, wholesale"
                        value={tagsInput}
                        onChange={(event) => setTagsInput(sanitizeFreeText(event.target.value))}
                        className={inputTone}
                        labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                      />
                    </div>
                    <div className="border-t border-[color:rgba(148,163,184,0.12)] pt-4">
                      <label className="inline-flex items-center gap-3 text-sm text-[var(--text)]">
                        <input
                          type="checkbox"
                          checked={isInShowroom}
                          onChange={(event) => setIsInShowroom(event.target.checked)}
                          className="h-4 w-4 rounded border border-[var(--border)] bg-transparent"
                        />
                        Is in showroom
                      </label>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <p className="text-xs text-[var(--text-soft)]/76">Cell phone</p>
                          <p className="mt-1 text-sm font-medium text-[var(--text)]">{detailValue(cellPhone)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--text-soft)]/76">Primary email</p>
                          <p className="mt-1 truncate text-sm font-medium text-[var(--text)]">{detailValue(primaryEmail)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--text-soft)]/76">Sales rep</p>
                          <p className="mt-1 text-sm font-medium text-[var(--text)]">
                            {assignedSelectOptions.find((option) => option.value === assignedTo)?.label ?? "Unassigned"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--text-soft)]/76">BDC rep</p>
                          <p className="mt-1 text-sm font-medium text-[var(--text)]">
                            {assignedSelectOptions.find((option) => option.value === bdcRepId)?.label ?? "Unassigned"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className={cn("space-y-2.5", isModal && "space-y-2")}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]/85">Step 3</p>
                {!isModal && <h2 className="text-[1.65rem] font-semibold tracking-[-0.03em] text-[var(--text)]">Profile details</h2>}
                <div className={sectionPanel}>
                  <div className="space-y-5">
                    <div className="grid gap-4">
                      <Input
                        label="Current address"
                        value={addressLine1}
                        onChange={(event) => setAddressLine1(sanitizeFreeText(event.target.value))}
                        className={inputTone}
                        labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label="Address line 2"
                        value={addressLine2}
                        onChange={(event) => setAddressLine2(sanitizeFreeText(event.target.value))}
                        className={inputTone}
                        labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <Input label="City" value={city} onChange={(event) => setCity(sanitizeFreeText(event.target.value))} className={inputTone} labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88" />
                      <Input label="State / Region" value={region} onChange={(event) => setRegion(sanitizeFreeText(event.target.value))} className={inputTone} labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88" />
                      <Input label="Postal code" value={postalCode} onChange={(event) => setPostalCode(sanitizePostalCodeInput(event.target.value))} className={inputTone} labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88" />
                      <Input label="Country" value={country} onChange={(event) => setCountry(sanitizeFreeText(event.target.value))} className={inputTone} labelClassName="text-[13px] font-medium text-[var(--text-soft)]/88" />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        <div className={cn("mt-auto", isModal ? "sticky bottom-0 z-10 border-t border-[var(--border)] bg-[color:rgba(8,15,32,0.94)] px-5 py-4 sm:px-6" : "")}>
          <div className={cn("flex flex-wrap items-center justify-between gap-3 px-4 py-3", modalDepthFooterSubtle)}>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[var(--text)]">
                {isDraftRecord ? "Draft is active. Save again to update it or create the final customer." : "Build the customer record with explicit save actions only."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {footerMetrics.map((metric) => (
                  <span key={metric} className={cn("px-3 py-1 text-xs text-[var(--text-soft)]/88", modalDepthChipSubtle)}>
                    {metric}
                  </span>
                ))}
              </div>
              {errors.submit ? (
                <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
                  {errors.submit}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button type="button" variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="button" variant="secondary" disabled={submitLoading || writeDisabled || loadingDraft} onClick={handleSaveDraft}>
                {submitLoading ? "Saving…" : "Save Draft"}
              </Button>
              <Button type="button" variant="secondary" disabled={submitLoading || writeDisabled || loadingDraft} onClick={handleSaveAndAddAnother}>
                Save &amp; Add Another
              </Button>
              <Button type="button" disabled={submitLoading || writeDisabled || loadingDraft} onClick={handleCreateCustomer}>
                {submitLoading ? "Saving…" : "Create Customer"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
