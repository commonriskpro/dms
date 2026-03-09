"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useWriteDisabled } from "@/components/write-guard";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { centsToDollarInput } from "@/lib/money";
import type { VehicleResponse, LocationOption } from "./types";
import {
  getSalePriceCents,
  getAuctionCostCents,
  getReconCostCents,
  getMiscCostCents,
  transportCostCents,
  VEHICLE_STATUS_OPTIONS,
} from "./types";
import {
  vehicleFormSchema,
  formToApiBody,
  type VehicleFormValues,
} from "./vehicle-form-schema";

const statusOptions: SelectOption[] = VEHICLE_STATUS_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

export function VehicleForm({
  vehicle,
  locations,
  onSubmit,
  submitLabel,
  isLoading,
  onVinDecode,
  vinDecodeLoading,
  vinDecodeError,
}: {
  vehicle?: VehicleResponse | null;
  locations: LocationOption[];
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  submitLabel: string;
  isLoading: boolean;
  onVinDecode?: (vin: string) => Promise<{ year?: number; make?: string; model?: string; trim?: string } | null>;
  vinDecodeLoading?: boolean;
  vinDecodeError?: string | null;
}) {
  const writeDisabled = useWriteDisabled();
  const [vin, setVin] = React.useState(vehicle?.vin ?? "");
  const [year, setYear] = React.useState(
    vehicle?.year != null ? String(vehicle.year) : ""
  );
  const [make, setMake] = React.useState(vehicle?.make ?? "");
  const [model, setModel] = React.useState(vehicle?.model ?? "");
  const [trim, setTrim] = React.useState(vehicle?.trim ?? "");
  const [stockNumber, setStockNumber] = React.useState(vehicle?.stockNumber ?? "");
  const [mileage, setMileage] = React.useState(
    vehicle?.mileage != null ? String(vehicle.mileage) : ""
  );
  const [color, setColor] = React.useState(vehicle?.color ?? "");
  const [status, setStatus] = React.useState(vehicle?.status ?? "AVAILABLE");
  const [salePriceDollars, setSalePriceDollars] = React.useState(
    vehicle ? centsToDollarInput(getSalePriceCents(vehicle)) : ""
  );
  const [auctionCostDollars, setAuctionCostDollars] = React.useState(
    vehicle ? centsToDollarInput(getAuctionCostCents(vehicle)) : ""
  );
  const [transportCostDollars, setTransportCostDollars] = React.useState(
    vehicle ? centsToDollarInput(transportCostCents(vehicle)) : ""
  );
  const [reconCostDollars, setReconCostDollars] = React.useState(
    vehicle ? centsToDollarInput(getReconCostCents(vehicle)) : ""
  );
  const [miscCostDollars, setMiscCostDollars] = React.useState(
    vehicle ? centsToDollarInput(getMiscCostCents(vehicle)) : ""
  );
  const [locationId, setLocationId] = React.useState(
    vehicle?.locationId ?? ""
  );

  const [errors, setErrors] = React.useState<Record<string, string | undefined>>({});

  const locationOptions: SelectOption[] = [
    { value: "", label: "Select location (optional)" },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ];

  const handleDecodeVin = async () => {
    const raw = vin.trim();
    if (raw.length < 8 || raw.length > 17) {
      setErrors((e) => ({ ...e, vin: "VIN must be 8–17 characters to decode" }));
      return;
    }
    setErrors((e) => ({ ...e, vin: undefined }));
    const result = await onVinDecode?.(raw);
    if (result) {
      if (result.year != null) setYear(String(result.year));
      if (result.make != null) setMake(result.make);
      if (result.model != null) setModel(result.model);
      if (result.trim != null) setTrim(result.trim);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw: VehicleFormValues = {
      vin: vin || undefined,
      year: year === "" ? undefined : Number(year),
      make: make || undefined,
      model: model || undefined,
      trim: trim || undefined,
      stockNumber,
      mileage: mileage === "" ? undefined : Number(mileage),
      color: color || undefined,
      status: status as VehicleFormValues["status"],
      salePriceDollars: salePriceDollars === "" ? undefined : salePriceDollars,
      auctionCostDollars: auctionCostDollars === "" ? undefined : auctionCostDollars,
      transportCostDollars: transportCostDollars === "" ? undefined : transportCostDollars,
      reconCostDollars: reconCostDollars === "" ? undefined : reconCostDollars,
      miscCostDollars: miscCostDollars === "" ? undefined : miscCostDollars,
      locationId: locationId || undefined,
    };
    const parsed = vehicleFormSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const path = issue.path[0];
        if (typeof path === "string") fieldErrors[path] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    const body = formToApiBody(parsed.data);
    await onSubmit(body);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">VIN decode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <Input
              label="VIN"
              placeholder="17 characters"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              maxLength={17}
              error={errors.vin}
              className="max-w-[220px]"
            />
            {onVinDecode && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleDecodeVin}
                disabled={vinDecodeLoading || vin.trim().length < 8}
              >
                {vinDecodeLoading ? "Decoding…" : "Decode VIN"}
              </Button>
            )}
          </div>
          {vinDecodeError && (
            <p className="text-sm text-[var(--danger)]">{vinDecodeError}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vehicle details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Stock number"
              value={stockNumber}
              onChange={(e) => setStockNumber(e.target.value)}
              error={errors.stockNumber}
              required
            />
            <Input
              label="VIN"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              maxLength={17}
              error={errors.vin}
            />
            <Input
              label="Year"
              type="number"
              placeholder="e.g. 2022"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              error={errors.year}
            />
            <Input
              label="Make"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              error={errors.make}
            />
            <Input
              label="Model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              error={errors.model}
            />
            <Input
              label="Trim"
              value={trim}
              onChange={(e) => setTrim(e.target.value)}
            />
            <Input
              label="Mileage"
              type="number"
              min={0}
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              error={errors.mileage}
            />
            <Input
              label="Color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <Select
              label="Status"
              options={statusOptions}
              value={status}
              onChange={setStatus}
            />
            <Select
              label="Location"
              options={locationOptions}
              value={locationId}
              onChange={setLocationId}
            />
            <Input
              label="Sale price ($)"
              placeholder="0.00"
              value={salePriceDollars}
              onChange={(e) => setSalePriceDollars(e.target.value)}
              error={errors.salePriceDollars}
            />
            <Input
              label="Auction cost ($)"
              placeholder="0.00"
              value={auctionCostDollars}
              onChange={(e) => setAuctionCostDollars(e.target.value)}
              error={errors.auctionCostDollars}
            />
            <Input
              label="Transport cost ($)"
              placeholder="0.00"
              value={transportCostDollars}
              onChange={(e) => setTransportCostDollars(e.target.value)}
              error={errors.transportCostDollars}
            />
            <Input
              label="Reconditioning cost ($)"
              placeholder="0.00"
              value={reconCostDollars}
              onChange={(e) => setReconCostDollars(e.target.value)}
              error={errors.reconCostDollars}
            />
            <Input
              label="Misc costs ($)"
              placeholder="0.00"
              value={miscCostDollars}
              onChange={(e) => setMiscCostDollars(e.target.value)}
              error={errors.miscCostDollars}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isLoading || writeDisabled.disabled} title={writeDisabled.title || undefined}>
              {isLoading ? "Saving…" : submitLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
