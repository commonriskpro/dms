"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  CustomerDetail,
  CustomerPhoneInput,
  CustomerEmailInput,
  CustomerStatus,
} from "@/lib/types/customers";
import { CUSTOMER_STATUS_OPTIONS } from "@/lib/types/customers";

type AssignedOption = { value: string; label: string };

export function CustomerForm({
  customer,
  assignedOptions,
  onSubmit,
  submitLabel,
  isLoading,
  submitDisabled,
}: {
  customer?: CustomerDetail | null;
  assignedOptions: AssignedOption[];
  onSubmit: (body: {
    name: string;
    status: CustomerStatus;
    leadSource?: string;
    leadCampaign?: string;
    leadMedium?: string;
    assignedTo?: string;
    tags?: string[];
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    phones?: CustomerPhoneInput[];
    emails?: CustomerEmailInput[];
  }) => Promise<void>;
  submitLabel: string;
  isLoading: boolean;
  /** When true (e.g. dealership suspended), submit is disabled. */
  submitDisabled?: boolean;
}) {
  const [name, setName] = React.useState(customer?.name ?? "");
  const [status, setStatus] = React.useState<CustomerStatus>(
    (customer?.status as CustomerStatus) ?? "LEAD"
  );
  const [leadSource, setLeadSource] = React.useState(customer?.leadSource ?? "");
  const [leadCampaign, setLeadCampaign] = React.useState(customer?.leadCampaign ?? "");
  const [leadMedium, setLeadMedium] = React.useState(customer?.leadMedium ?? "");
  const [assignedTo, setAssignedTo] = React.useState(customer?.assignedTo ?? "");
  const [tagsInput, setTagsInput] = React.useState(
    customer?.tags?.length ? customer.tags.join(", ") : ""
  );
  const [addressLine1, setAddressLine1] = React.useState(customer?.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = React.useState(customer?.addressLine2 ?? "");
  const [city, setCity] = React.useState(customer?.city ?? "");
  const [region, setRegion] = React.useState(customer?.region ?? "");
  const [postalCode, setPostalCode] = React.useState(customer?.postalCode ?? "");
  const [country, setCountry] = React.useState(customer?.country ?? "");

  const [phones, setPhones] = React.useState<CustomerPhoneInput[]>(() =>
    customer?.phones?.length
      ? customer.phones.map((p) => ({ kind: p.kind ?? undefined, value: p.value, isPrimary: p.isPrimary }))
      : [{ kind: undefined, value: "", isPrimary: true }]
  );
  const [emails, setEmails] = React.useState<CustomerEmailInput[]>(() =>
    customer?.emails?.length
      ? customer.emails.map((e) => ({ kind: e.kind ?? undefined, value: e.value, isPrimary: e.isPrimary }))
      : [{ kind: undefined, value: "", isPrimary: true }]
  );

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const statusOptions: SelectOption[] = CUSTOMER_STATUS_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }));
  const assignedSelectOptions: SelectOption[] = [
    { value: "", label: "Unassigned" },
    ...assignedOptions,
  ];

  const setPrimaryPhone = (index: number) => {
    setPhones((prev) =>
      prev.map((p, i) => ({ ...p, isPrimary: i === index }))
    );
  };
  const setPrimaryEmail = (index: number) => {
    setEmails((prev) =>
      prev.map((e, i) => ({ ...e, isPrimary: i === index }))
    );
  };
  const addPhone = () => {
    setPhones((prev) => [...prev, { kind: undefined, value: "", isPrimary: prev.every((p) => !p.isPrimary) }]);
  };
  const removePhone = (index: number) => {
    setPhones((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length && next.every((p) => !p.isPrimary)) next[0].isPrimary = true;
      return next;
    });
  };
  const addEmail = () => {
    setEmails((prev) => [...prev, { kind: undefined, value: "", isPrimary: prev.every((e) => !e.isPrimary) }]);
  };
  const removeEmail = (index: number) => {
    setEmails((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length && next.every((e) => !e.isPrimary)) next[0].isPrimary = true;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrim = name.trim();
    if (!nameTrim) {
      setErrors({ name: "Name is required" });
      return;
    }
    const tags = tagsInput
      .split(/,\s*/)
      .map((t) => t.trim())
      .filter(Boolean);
    const phonesFiltered = phones
      .map((p) => ({ kind: p.kind || undefined, value: p.value.trim(), isPrimary: !!p.isPrimary }))
      .filter((p) => p.value.length > 0);
    const emailsFiltered = emails
      .map((e) => ({ kind: e.kind || undefined, value: e.value.trim(), isPrimary: !!e.isPrimary }))
      .filter((e) => e.value.length > 0);
    if (phonesFiltered.length && !phonesFiltered.some((p) => p.isPrimary)) {
      phonesFiltered[0].isPrimary = true;
    }
    if (emailsFiltered.length && !emailsFiltered.some((e) => e.isPrimary)) {
      emailsFiltered[0].isPrimary = true;
    }
    setErrors({});
    try {
      await onSubmit({
        name: nameTrim,
        status,
        leadSource: leadSource.trim() || undefined,
        leadCampaign: leadCampaign.trim() || undefined,
        leadMedium: leadMedium.trim() || undefined,
        assignedTo: assignedTo.trim() || undefined,
        tags: tags.length ? tags : undefined,
        addressLine1: addressLine1.trim() || undefined,
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim() || undefined,
        region: region.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        country: country.trim() || undefined,
        phones: phonesFiltered.length ? phonesFiltered : undefined,
        emails: emailsFiltered.length ? emailsFiltered : undefined,
      });
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : "Failed to save" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            error={errors.name}
            aria-required="true"
          />
          <Select
            label="Status"
            options={statusOptions}
            value={status}
            onChange={(v) => setStatus(v as CustomerStatus)}
          />
          <Input
            label="Lead source"
            placeholder="e.g. Website"
            value={leadSource}
            onChange={(e) => setLeadSource(e.target.value)}
          />
          <Input
            label="Campaign"
            placeholder="e.g. Spring 2025"
            value={leadCampaign}
            onChange={(e) => setLeadCampaign(e.target.value)}
          />
          <Input
            label="Medium"
            placeholder="e.g. email, cpc"
            value={leadMedium}
            onChange={(e) => setLeadMedium(e.target.value)}
          />
          {assignedSelectOptions.length > 1 && (
            <Select
              label="Assigned to"
              options={assignedSelectOptions}
              value={assignedTo}
              onChange={setAssignedTo}
            />
          )}
          <Input
            label="Tags"
            placeholder="Comma-separated"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Address line 1"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
          />
          <Input
            label="Address line 2"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
            <Input label="Region / State" value={region} onChange={(e) => setRegion(e.target.value)} />
            <Input label="Postal code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            <Input label="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {phones.map((p, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input
                label={i === 0 ? "Kind (e.g. mobile)" : ""}
                placeholder="Kind"
                value={p.kind ?? ""}
                onChange={(e) =>
                  setPhones((prev) => {
                    const next = [...prev];
                    next[i] = { ...next[i], kind: e.target.value || undefined };
                    return next;
                  })
                }
                className="w-24"
              />
              <Input
                label={i === 0 ? "Number" : ""}
                placeholder="Phone"
                value={p.value}
                onChange={(e) =>
                  setPhones((prev) => {
                    const next = [...prev];
                    next[i] = { ...next[i], value: e.target.value };
                    return next;
                  })
                }
                className="flex-1 min-w-[120px]"
              />
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={!!p.isPrimary}
                  onChange={() => setPrimaryPhone(i)}
                  aria-label={`Primary phone ${i + 1}`}
                />
                Primary
              </label>
              {phones.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removePhone(i)}
                  aria-label={`Remove phone ${i + 1}`}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={addPhone}>
            Add phone
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Emails</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {emails.map((e, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input
                label={i === 0 ? "Kind" : ""}
                placeholder="Kind"
                value={e.kind ?? ""}
                onChange={(ev) =>
                  setEmails((prev) => {
                    const next = [...prev];
                    next[i] = { ...next[i], kind: ev.target.value || undefined };
                    return next;
                  })
                }
                className="w-24"
              />
              <Input
                label={i === 0 ? "Email" : ""}
                type="email"
                placeholder="Email"
                value={e.value}
                onChange={(ev) =>
                  setEmails((prev) => {
                    const next = [...prev];
                    next[i] = { ...next[i], value: ev.target.value };
                    return next;
                  })
                }
                className="flex-1 min-w-[160px]"
              />
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={!!e.isPrimary}
                  onChange={() => setPrimaryEmail(i)}
                  aria-label={`Primary email ${i + 1}`}
                />
                Primary
              </label>
              {emails.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEmail(i)}
                  aria-label={`Remove email ${i + 1}`}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={addEmail}>
            Add email
          </Button>
        </CardContent>
      </Card>

      {errors.submit && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {errors.submit}
        </p>
      )}
      <Button type="submit" disabled={isLoading || submitDisabled}>
        {isLoading ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
