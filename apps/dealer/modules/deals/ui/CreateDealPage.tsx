"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { MutationButton } from "@/components/write-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/ui/page-shell";
import { Popover } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandItem, CommandList } from "@/components/ui/command";
import { getNewDealRedirectHref } from "./deal-workspace-href";
import {
  formatCents,
  parseDollarsToCents,
  isValidDollarInput,
  percentToBps,
} from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  modalDepthChipSubtle,
  modalDepthFooterSubtle,
  modalDepthInteractive,
  modalDepthSurfaceStrong,
  modalFieldTone,
} from "@/lib/ui/modal-depth";
import type { DealMode } from "./types";
import { Check, ChevronsUpDown } from "lucide-react";

type CustomerOption = { id: string; name: string };
type VehicleOption = {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  stockNumber: string;
  purchasePrice: number | null;
};

const fieldTone = cn("h-11 rounded-xl px-4 text-sm", modalFieldTone);
const sectionPanel = cn("rounded-[24px] p-5 sm:p-6", modalDepthSurfaceStrong);

type SearchOption = {
  value: string;
  label: string;
  searchText: string;
  detail?: string;
};

function SearchablePicker({
  label,
  value,
  options,
  placeholder,
  emptyText,
  onChange,
}: {
  label: string;
  value: string;
  options: SearchOption[];
  placeholder: string;
  emptyText: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const selected = options.find((option) => option.value === value) ?? null;

  React.useEffect(() => {
    setInputValue(selected?.label ?? "");
  }, [selected?.label]);

  React.useEffect(() => {
    const nextQuery = inputValue.trim().toLowerCase();
    const timer = window.setTimeout(() => {
      setDebouncedQuery(nextQuery);
      setOpen(nextQuery.length > 0);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [inputValue]);

  const filtered = React.useMemo(() => {
    if (!debouncedQuery) return options;
    return options.filter((option) => option.searchText.includes(debouncedQuery));
  }, [options, debouncedQuery]);

  return (
    <div className="w-full">
      <label className="mb-1 block text-sm font-medium text-[var(--text)]">{label}</label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next && selected) {
            setInputValue(selected.label);
          }
        }}
        className="w-full"
        trigger={(
          <div
            className={cn(
              "flex w-full items-center gap-2",
              fieldTone
            )}
          >
            <input
              type="text"
              value={inputValue}
              onChange={(event) => {
                const nextValue = event.target.value;
                setInputValue(nextValue);
                if (value && nextValue !== selected?.label) {
                  onChange("");
                }
              }}
              onFocus={() => setOpen(inputValue.trim().length > 0)}
              placeholder={placeholder}
              className={cn(
                "w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-soft)]",
                inputValue ? "text-[var(--text)]" : "text-[var(--text-soft)]"
              )}
              role="combobox"
              aria-autocomplete="list"
              aria-controls={`${label.toLowerCase().replace(/\s+/g, "-")}-results`}
              aria-expanded={open}
              aria-haspopup="dialog"
            />
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              className="shrink-0 text-[var(--text-soft)]"
              aria-label={`Toggle ${label.toLowerCase()} search`}
            >
              <ChevronsUpDown className="h-4 w-4" />
            </button>
          </div>
        )}
      >
        <div className="w-[var(--radix-popover-trigger-width,24rem)] min-w-[280px] p-2">
          <Command className="bg-transparent">
            <CommandList
              id={`${label.toLowerCase().replace(/\s+/g, "-")}-results`}
              className="mt-2 max-h-64"
            >
              <CommandEmpty>{emptyText}</CommandEmpty>
              {filtered.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.searchText}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                    setInputValue(option.label);
                    setDebouncedQuery("");
                  }}
                  className="flex items-start justify-between gap-3 rounded-xl px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[var(--text)]">{option.label}</div>
                    {option.detail ? (
                      <div className="truncate text-xs text-[var(--text-soft)]">{option.detail}</div>
                    ) : null}
                  </div>
                  {value === option.value ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </div>
      </Popover>
    </div>
  );
}

export function CreateDealPage({ mode = "page" }: { mode?: "page" | "modal" } = {}) {
  const isModal = mode === "modal";
  const router = useRouter();
  const { addToast } = useToast();
  const { hasPermission } = useSession();
  const canWrite = hasPermission("deals.write");
  const canReadCustomers = hasPermission("customers.read");
  const canReadInventory = hasPermission("inventory.read");

  const [customers, setCustomers] = React.useState<CustomerOption[]>([]);
  const [vehicles, setVehicles] = React.useState<VehicleOption[]>([]);
  const [customerId, setCustomerId] = React.useState("");
  const [vehicleId, setVehicleId] = React.useState("");
  const [financingMode, setFinancingMode] = React.useState<DealMode>("FINANCE");
  const [salePriceDollars, setSalePriceDollars] = React.useState("");
  const [taxRatePercent, setTaxRatePercent] = React.useState("");
  const [docFeeDollars, setDocFeeDollars] = React.useState("");
  const [downPaymentDollars, setDownPaymentDollars] = React.useState("");
  const [salePriceError, setSalePriceError] = React.useState<string | null>(null);
  const [taxRateError, setTaxRateError] = React.useState<string | null>(null);
  const [docFeeError, setDocFeeError] = React.useState<string | null>(null);
  const [downPaymentError, setDownPaymentError] = React.useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = React.useState(false);

  React.useEffect(() => {
    if (!canReadCustomers) return;
    apiFetch<{ data: { id: string; name: string }[] }>(
      "/api/customers?limit=250&offset=0"
    )
      .then((r) => setCustomers(r.data ?? []))
      .catch(() => setCustomers([]));
  }, [canReadCustomers]);

  React.useEffect(() => {
    if (!canReadInventory) return;
    apiFetch<{
      data: {
        id: string;
        year: number | null;
        make: string | null;
        model: string | null;
        stockNumber: string;
        purchasePrice: number | null;
      }[];
    }>("/api/inventory?limit=250&offset=0")
      .then((r) =>
        setVehicles(
          (r.data ?? []).map((v) => ({
            id: v.id,
            year: v.year,
            make: v.make,
            model: v.model,
            stockNumber: v.stockNumber,
            purchasePrice: v.purchasePrice,
          }))
        )
      )
      .catch(() => setVehicles([]));
  }, [canReadInventory]);

  const selectedVehicle = React.useMemo(
    () => vehicles.find((v) => v.id === vehicleId),
    [vehicles, vehicleId]
  );
  const selectedCustomer = React.useMemo(
    () => customers.find((customer) => customer.id === customerId) ?? null,
    [customers, customerId]
  );
  const salePriceCents = parseDollarsToCents(salePriceDollars || "0");
  const downPaymentCents = parseDollarsToCents(downPaymentDollars || "0");
  const deskBalanceCents =
    salePriceCents && downPaymentCents
      ? String(
          (BigInt(salePriceCents || "0") - BigInt(downPaymentCents || "0")) > BigInt(0)
            ? BigInt(salePriceCents || "0") - BigInt(downPaymentCents || "0")
            : BigInt(0)
        )
      : salePriceCents || "0";
  const inventoryCostCents =
    selectedVehicle?.purchasePrice != null
      ? parseDollarsToCents(String(selectedVehicle.purchasePrice)) || "0"
      : "0";
  const priceSpreadCents =
    salePriceCents && inventoryCostCents
      ? String(BigInt(salePriceCents) - BigInt(inventoryCostCents))
      : "0";

  const validateMoney = (dollars: string, setError: (s: string | null) => void) => {
    if (!dollars.trim()) {
      setError(null);
      return true;
    }
    if (!isValidDollarInput(dollars)) {
      setError("Enter a valid amount (e.g. 15000 or 15000.50)");
      return false;
    }
    const cents = parseDollarsToCents(dollars);
    if (cents === "") {
      setError("Invalid currency input");
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;

    setSalePriceError(null);
    setTaxRateError(null);
    setDocFeeError(null);
    setDownPaymentError(null);

    const saleCents = parseDollarsToCents(salePriceDollars);
    const docCents = parseDollarsToCents(docFeeDollars || "0");
    const downCents = parseDollarsToCents(downPaymentDollars || "0");

    if (
      !validateMoney(salePriceDollars, setSalePriceError) ||
      !saleCents ||
      saleCents === "0"
    ) {
      if (!salePriceDollars.trim()) setSalePriceError("Sale price is required");
      else if (!salePriceError) setSalePriceError("Enter a valid sale price");
      return;
    }
    const taxBps = percentToBps(taxRatePercent);
    if (taxBps < 0 || taxBps > 10000) {
      setTaxRateError("Tax rate must be between 0 and 100%");
      return;
    }
    if (!validateMoney(docFeeDollars, setDocFeeError) && docFeeDollars.trim()) return;
    if (!validateMoney(downPaymentDollars, setDownPaymentError) && downPaymentDollars.trim()) return;

    if (!customerId.trim()) {
      addToast("error", "Please select a customer");
      return;
    }
    if (!vehicleId.trim()) {
      addToast("error", "Please select a vehicle");
      return;
    }

    const purchasePriceCents =
      selectedVehicle?.purchasePrice != null
        ? parseDollarsToCents(String(selectedVehicle.purchasePrice))
        : "0";
    if (!purchasePriceCents && selectedVehicle?.purchasePrice != null) {
      addToast("error", "Invalid vehicle cost; try another vehicle.");
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await apiFetch<{ data: { id: string } }>("/api/deals", {
        method: "POST",
        body: JSON.stringify({
          customerId,
          vehicleId,
          financingMode,
          salePriceCents: saleCents,
          purchasePriceCents: purchasePriceCents || "0",
          taxRateBps: taxBps,
          docFeeCents: docCents || "0",
          downPaymentCents: downCents || "0",
        }),
      });
      addToast("success", "Deal created");
      router.refresh();
      router.push(getNewDealRedirectHref(res.data.id, financingMode));
    } catch (e) {
      const msg = getApiErrorMessage(e);
      if (msg.toLowerCase().includes("active deal") || msg.toLowerCase().includes("vehicle already")) {
        addToast("error", "This vehicle already has an active deal.");
      } else {
        addToast("error", msg);
      }
      setSubmitLoading(false);
    }
  };

  if (!canWrite) {
    const blocked = (
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-soft)]">
            Deal intake
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text)]">
            Create deal
          </h1>
        </div>
        <div className={sectionPanel}>
          <p className="text-[var(--text-soft)]">Not allowed. You need `deals.write` to create deals.</p>
          <Link href="/deals">
            <Button variant="secondary" className="mt-4">
              Back to Deals
            </Button>
          </Link>
        </div>
      </div>
    );

    return isModal ? blocked : <PageShell className="space-y-6">{blocked}</PageShell>;
  }

  const customerSearchOptions = customers.map((customer) => ({
    value: customer.id,
    label: customer.name || customer.id,
    detail: customer.id,
    searchText: `${customer.name || ""} ${customer.id}`.toLowerCase(),
  }));
  const vehicleSearchOptions = vehicles.map((vehicle) => {
    const vehicleName =
      [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicle.stockNumber || vehicle.id;
    return {
      value: vehicle.id,
      label: vehicleName,
      detail: vehicle.stockNumber,
      searchText: `${vehicleName} ${vehicle.stockNumber} ${vehicle.id}`.toLowerCase(),
    };
  });

  const content = (
    <form
      onSubmit={handleSubmit}
      className={cn("space-y-6", isModal ? "px-5 py-5 sm:px-7 sm:py-6" : "")}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-soft)]">
              Deal intake
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[var(--text)]">
              Create deal
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]", modalDepthChipSubtle)}>
              {financingMode === "FINANCE" ? "Finance path" : "Cash path"}
            </span>
            <span className={cn("inline-flex items-center px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]", modalDepthChipSubtle)}>
              {selectedCustomer ? "Customer ready" : "Customer open"}
            </span>
            <span className={cn("inline-flex items-center px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]", modalDepthChipSubtle)}>
              {selectedVehicle ? "Vehicle ready" : "Vehicle open"}
            </span>
          </div>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
          Start the sale with the buyer, the unit, and the desk posture that will drive the rest
          of the workflow. Cash deals move directly into delivery and title. Finance deals continue
          into lender approval and funding.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.18fr_0.82fr]">
        <section className={sectionPanel}>
          <div className="mb-5 flex items-start justify-between gap-4 border-b border-[var(--border)]/70 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
                Step 1
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text)]">
                Buyer, unit, and desk
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[var(--text-soft)]">
              Bind the customer and vehicle first, then set the initial sale posture before the deal
              enters the cash or finance branch.
            </p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--text)]">Payment mode</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {([
                  {
                    value: "CASH",
                    title: "Cash",
                    detail: "Keep the desk light and move directly into delivery and title.",
                  },
                  {
                    value: "FINANCE",
                    title: "Finance",
                    detail: "Continue into approval, lender workflow, and funding.",
                  },
                ] as const).map((option) => {
                  const active = financingMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFinancingMode(option.value)}
                      className={cn(
                        "rounded-[20px] border px-4 py-4 text-left transition",
                        active
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]/35 text-[var(--text)] shadow-[var(--shadow-card)]"
                          : cn("text-[var(--text-soft)] hover:border-[var(--accent)]/40 hover:text-[var(--text)]", modalDepthInteractive)
                      )}
                      aria-pressed={active}
                    >
                      <div className="text-sm font-semibold">{option.title}</div>
                      <div className="mt-1 text-xs leading-5 text-inherit/80">{option.detail}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SearchablePicker
                label="Customer"
                value={customerId}
                options={customerSearchOptions}
                placeholder="Search customer"
                emptyText="No customers found."
                onChange={setCustomerId}
              />
              <SearchablePicker
                label="Vehicle"
                value={vehicleId}
                options={vehicleSearchOptions}
                placeholder="Search vehicle"
                emptyText="No vehicles found."
                onChange={setVehicleId}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
              <Input
                label="Sale price ($)"
                value={salePriceDollars}
                onChange={(e) => setSalePriceDollars(e.target.value)}
                placeholder="e.g. 25000.00"
                error={salePriceError ?? undefined}
                onBlur={() => salePriceDollars && validateMoney(salePriceDollars, setSalePriceError)}
                className={fieldTone}
              />
              <Input
                label="Tax rate (%)"
                type="text"
                inputMode="decimal"
                value={taxRatePercent}
                onChange={(e) => setTaxRatePercent(e.target.value)}
                placeholder="e.g. 7.25"
                error={taxRateError ?? undefined}
                className={fieldTone}
              />
              <Input
                label="Doc fee ($)"
                value={docFeeDollars}
                onChange={(e) => setDocFeeDollars(e.target.value)}
                placeholder="e.g. 499.00"
                error={docFeeError ?? undefined}
                onBlur={() => docFeeDollars && validateMoney(docFeeDollars, setDocFeeError)}
                className={fieldTone}
              />
              <Input
                label={financingMode === "FINANCE" ? "Cash down ($)" : "Cash collected ($)"}
                value={downPaymentDollars}
                onChange={(e) => setDownPaymentDollars(e.target.value)}
                placeholder="e.g. 2000.00"
                error={downPaymentError ?? undefined}
                onBlur={() =>
                  downPaymentDollars && validateMoney(downPaymentDollars, setDownPaymentError)
                }
                className={fieldTone}
              />
            </div>
          </div>
        </section>

        <div className="space-y-4">
          <section className={sectionPanel}>
            <div className="mb-4 border-b border-[var(--border)]/70 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
                Step 2
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text)]">
                Execution posture
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className={cn("rounded-[18px] p-4", modalDepthInteractive)}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                  Inventory cost
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text)]">
                  {formatCents(inventoryCostCents)}
                </p>
                <p className="mt-1 text-xs text-[var(--text-soft)]">Current unit basis</p>
              </div>
              <div className={cn("rounded-[18px] p-4", modalDepthInteractive)}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                  Price posture
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text)]">
                  {formatCents(priceSpreadCents)}
                </p>
                <p className="mt-1 text-xs text-[var(--text-soft)]">Desk spread vs cost</p>
              </div>
              <div className={cn("rounded-[18px] p-4", modalDepthInteractive)}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                  Down at close
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text)]">
                  {formatCents(downPaymentCents || "0")}
                </p>
                <p className="mt-1 text-xs text-[var(--text-soft)]">
                  {financingMode === "FINANCE" ? "Cash down applied to finance" : "Collected before delivery"}
                </p>
              </div>
              <div className={cn("rounded-[18px] p-4", modalDepthInteractive)}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                  Balance
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text)]">
                  {formatCents(deskBalanceCents)}
                </p>
                <p className="mt-1 text-xs text-[var(--text-soft)]">
                  {financingMode === "FINANCE" ? "Feeds finance structure" : "Remaining cash due"}
                </p>
              </div>
            </div>
          </section>

          <section className={sectionPanel}>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
                  Step 3
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text)]">
                  Next track
                </h2>
              </div>
              <div className={cn("rounded-[20px] p-4", modalDepthInteractive)}>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {financingMode === "FINANCE" ? "Finance deal" : "Cash deal"}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                  {financingMode === "FINANCE"
                    ? "The deal opens in the finance workspace so the desk can move immediately into lender structure, approval, and funding."
                    : "The deal opens in the shared desk, then moves into delivery and title without carrying lender or funding steps."}
                </p>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[var(--text-soft)]">Customer</dt>
                  <dd className="font-medium text-[var(--text)]">
                    {selectedCustomer?.name ?? "Select customer"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[var(--text-soft)]">Vehicle</dt>
                  <dd className="font-medium text-[var(--text)]">
                    {selectedVehicle
                      ? [selectedVehicle.year, selectedVehicle.make, selectedVehicle.model]
                          .filter(Boolean)
                          .join(" ") || selectedVehicle.stockNumber
                      : "Select vehicle"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[var(--text-soft)]">Desk path</dt>
                  <dd className="font-medium text-[var(--text)]">
                    {financingMode === "FINANCE" ? "Desk → Finance → Delivery → Funding → Title" : "Desk → Delivery → Title"}
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        </div>
      </div>

      <div className={cn("flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5", modalDepthFooterSubtle)}>
        <div>
          <p className="text-sm text-[var(--text)]">
            Build the deal with an explicit cash or finance path from the start.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-[var(--text-soft)]">
            <span className={cn("px-3 py-1", modalDepthChipSubtle)}>{selectedCustomer ? "Customer set" : "Customer open"}</span>
            <span className={cn("px-3 py-1", modalDepthChipSubtle)}>{selectedVehicle ? "Vehicle set" : "Vehicle open"}</span>
            <span className={cn("px-3 py-1", modalDepthChipSubtle)}>{financingMode === "FINANCE" ? "Finance branch" : "Cash branch"}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/deals">
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </Link>
          <MutationButton type="submit" disabled={submitLoading}>
            {submitLoading
              ? "Creating…"
              : financingMode === "CASH"
                ? "Create cash deal"
                : "Create finance deal"}
          </MutationButton>
        </div>
      </div>
    </form>
  );

  return isModal ? content : <PageShell className="space-y-6">{content}</PageShell>;
}
