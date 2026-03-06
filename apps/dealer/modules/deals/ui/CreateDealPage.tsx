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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, type SelectOption } from "@/components/ui/select";
import {
  parseDollarsToCents,
  isValidDollarInput,
  percentToBps,
} from "@/lib/money";

type CustomerOption = { id: string; name: string };
type VehicleOption = {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  stockNumber: string;
  purchasePrice: number | null;
};

export function CreateDealPage() {
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
      "/api/customers?limit=100&offset=0"
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
    }>("/api/inventory?limit=100&offset=0")
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
          salePriceCents: saleCents,
          purchasePriceCents: purchasePriceCents || "0",
          taxRateBps: taxBps,
          docFeeCents: docCents || "0",
          downPaymentCents: downCents || "0",
        }),
      });
      addToast("success", "Deal created");
      router.refresh();
      router.push(`/deals/${res.data.id}`);
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
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--text)]">New Deal</h1>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
          <p className="text-[var(--text-soft)]">Not allowed. You need deals.write to create deals.</p>
          <Link href="/deals">
            <Button variant="secondary" className="mt-4">
              Back to Deals
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const customerOptions: SelectOption[] = [
    { value: "", label: "Select customer" },
    ...customers.map((c) => ({ value: c.id, label: c.name || c.id })),
  ];
  const vehicleOptions: SelectOption[] = [
    { value: "", label: "Select vehicle" },
    ...vehicles.map((v) => {
      const label = [v.year, v.make, v.model].filter(Boolean).join(" ") || v.stockNumber || v.id;
      return { value: v.id, label };
    }),
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--text)]">New Deal</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deal structure</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
            <Select
              label="Customer (required)"
              options={customerOptions}
              value={customerId}
              onChange={setCustomerId}
              required
            />
            <Select
              label="Vehicle (required)"
              options={vehicleOptions}
              value={vehicleId}
              onChange={setVehicleId}
              required
            />
            <Input
              label="Sale price ($)"
              value={salePriceDollars}
              onChange={(e) => setSalePriceDollars(e.target.value)}
              placeholder="e.g. 25000.00"
              error={salePriceError ?? undefined}
              onBlur={() => salePriceDollars && validateMoney(salePriceDollars, setSalePriceError)}
            />
            <Input
              label="Tax rate (%)"
              type="text"
              inputMode="decimal"
              value={taxRatePercent}
              onChange={(e) => setTaxRatePercent(e.target.value)}
              placeholder="e.g. 7.25"
              error={taxRateError ?? undefined}
            />
            <Input
              label="Doc fee ($)"
              value={docFeeDollars}
              onChange={(e) => setDocFeeDollars(e.target.value)}
              placeholder="e.g. 499.00"
              error={docFeeError ?? undefined}
              onBlur={() => docFeeDollars && validateMoney(docFeeDollars, setDocFeeError)}
            />
            <Input
              label="Down payment ($)"
              value={downPaymentDollars}
              onChange={(e) => setDownPaymentDollars(e.target.value)}
              placeholder="e.g. 2000.00"
              error={downPaymentError ?? undefined}
              onBlur={() =>
                downPaymentDollars && validateMoney(downPaymentDollars, setDownPaymentError)
              }
            />
            <div className="flex gap-3 pt-2">
              <MutationButton type="submit" disabled={submitLoading}>
                {submitLoading ? "Creating…" : "Create deal"}
              </MutationButton>
              <Link href="/deals">
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
