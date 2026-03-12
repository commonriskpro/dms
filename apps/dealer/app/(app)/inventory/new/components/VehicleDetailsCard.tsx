"use client";

import * as React from "react";
import { DMSCard, DMSCardHeader, DMSCardTitle, DMSCardContent } from "@/components/ui/dms-card";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { FancySelect } from "@/components/ui/fancy-select";
import { Button } from "@/components/ui/button";
import { VEHICLE_STATUS_OPTIONS } from "@/modules/inventory/ui/types";
import { modalDepthInteractive, modalFieldTone } from "@/lib/ui/modal-depth";

const BODY_STYLE_OPTIONS: SelectOption[] = [
  { value: "", label: "Select" },
  { value: "Truck", label: "Truck" },
  { value: "Sedan", label: "Sedan" },
  { value: "SUV", label: "SUV" },
  { value: "Coupe", label: "Coupe" },
  { value: "Van", label: "Van" },
  { value: "Hatchback", label: "Hatchback" },
];

const TRANSMISSION_OPTIONS: SelectOption[] = [
  { value: "", label: "Select" },
  { value: "Automatic", label: "Automatic" },
  { value: "Manual", label: "Manual" },
  { value: "CVT", label: "CVT" },
  { value: "DCT", label: "DCT" },
];

const FUEL_OPTIONS: SelectOption[] = [
  { value: "", label: "Select" },
  { value: "Gas", label: "Gas" },
  { value: "Gasoline", label: "Gasoline" },
  { value: "Diesel", label: "Diesel" },
  { value: "Electric", label: "Electric" },
  { value: "Hybrid", label: "Hybrid" },
];

const COLOR_OPTIONS: SelectOption[] = [
  { value: "", label: "Select" },
  { value: "Black", label: "Black" },
  { value: "Jet Black", label: "Jet Black" },
  { value: "White", label: "White" },
  { value: "Silver", label: "Silver" },
  { value: "Gray", label: "Gray" },
  { value: "Red", label: "Red" },
  { value: "Blue", label: "Blue" },
  { value: "Other", label: "Other" },
];

const statusOptions: SelectOption[] = [
  { value: "", label: "Select status" },
  ...VEHICLE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
];

export interface VehicleDetailsCardProps {
  stockNumber: string;
  onStockNumberChange: (v: string) => void;
  vinDisplay: string;
  year: string;
  onYearChange: (v: string) => void;
  make: string;
  onMakeChange: (v: string) => void;
  model: string;
  onModelChange: (v: string) => void;
  trim: string;
  onTrimChange: (v: string) => void;
  mileage: string;
  onMileageChange: (v: string) => void;
  color: string;
  onColorChange: (v: string) => void;
  bodyStyle: string;
  onBodyStyleChange: (v: string) => void;
  transmission: string;
  onTransmissionChange: (v: string) => void;
  fuelType: string;
  onFuelTypeChange: (v: string) => void;
  engine: string;
  onEngineChange: (v: string) => void;
  yearDecoded?: boolean;
  makeDecoded?: boolean;
  modelDecoded?: boolean;
  errors?: Partial<Record<string, string>>;
  onDecodeStock?: () => void;
  compact?: boolean;
}

export function VehicleDetailsCard({
  stockNumber,
  onStockNumberChange,
  vinDisplay,
  year,
  onYearChange,
  make,
  onMakeChange,
  model,
  onModelChange,
  trim,
  onTrimChange,
  mileage,
  onMileageChange,
  color,
  onColorChange,
  bodyStyle,
  onBodyStyleChange,
  transmission,
  onTransmissionChange,
  fuelType,
  onFuelTypeChange,
  engine,
  onEngineChange,
  yearDecoded,
  makeDecoded,
  modelDecoded,
  errors = {},
  onDecodeStock,
  compact = false,
}: VehicleDetailsCardProps) {
  const decodedInputClass = "bg-[var(--success-muted)]";
  const modalInputClass = `${modalFieldTone} h-10`;
  const modalLabelClass = "text-[13px] font-medium text-[var(--text-soft)]/88";
  if (compact) {
    return (
      <div className="pt-1">
        <div className="grid gap-4 xl:grid-cols-3 xl:gap-0">
          <div className={`${modalDepthInteractive} space-y-3 px-4 py-4 xl:mr-2 xl:pr-5`}>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-[7px] bg-[var(--surface-2)]/55 text-[var(--text-soft)]">
                <BasicsIcon className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-[15px] font-semibold text-[var(--text)]/95">Vehicle Basics</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-[118px_minmax(0,1fr)]">
              <div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[120px] flex-1">
                    <Input
                      label="Stock #"
                      value={stockNumber}
                      onChange={(e) => onStockNumberChange(e.target.value)}
                      error={errors.stockNumber}
                      className={modalInputClass}
                      labelClassName={modalLabelClass}
                    />
                  </div>
                  {onDecodeStock ? (
                    <Button type="button" variant="secondary" size="sm" onClick={onDecodeStock} aria-label="Decode from barcode">
                      <BarcodeIcon className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
              <Input
                label="VIN"
                value={vinDisplay}
                readOnly
                disabled
                className={`${modalInputClass} text-[var(--text-soft)]`}
                labelClassName={modalLabelClass}
              />
              <Input
                label="Year"
                value={year}
                onChange={(e) => onYearChange(e.target.value)}
                placeholder="e.g. 2021"
                className={yearDecoded ? decodedInputClass : modalInputClass}
                error={errors.year}
                labelClassName={modalLabelClass}
              />
              <Input
                label="Mileage"
                value={mileage}
                onChange={(e) => onMileageChange(e.target.value)}
                placeholder="e.g. 50412"
                className={modalInputClass}
                error={errors.mileage}
                labelClassName={modalLabelClass}
              />
            </div>
          </div>

          <div className={`${modalDepthInteractive} space-y-3 px-4 py-4 xl:mx-1 xl:px-5`}>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-[7px] bg-[var(--surface-2)]/55 text-[var(--text-soft)]">
                <SpecsIcon className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-[15px] font-semibold text-[var(--text)]/95">Specifications</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <Input
                label="Make"
                value={make}
                onChange={(e) => onMakeChange(e.target.value)}
                className={makeDecoded ? decodedInputClass : modalInputClass}
                error={errors.make}
                labelClassName={modalLabelClass}
              />
              <Input
                label="Model"
                value={model}
                onChange={(e) => onModelChange(e.target.value)}
                className={modelDecoded ? decodedInputClass : modalInputClass}
                error={errors.model}
                labelClassName={modalLabelClass}
              />
              <Input label="Trim" value={trim} onChange={(e) => onTrimChange(e.target.value)} placeholder="e.g. LTZ AWD" className={modalInputClass} labelClassName={modalLabelClass} />
              <FancySelect
                label="Body Style"
                options={BODY_STYLE_OPTIONS}
                value={bodyStyle}
                onChange={onBodyStyleChange}
                triggerClassName={modalInputClass}
                labelClassName={modalLabelClass}
              />
            </div>
          </div>

          <div className={`${modalDepthInteractive} space-y-3 px-4 py-4 xl:ml-2 xl:pl-5`}>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-[7px] bg-[var(--surface-2)]/55 text-[var(--text-soft)]">
                <AppearanceIcon className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-[15px] font-semibold text-[var(--text)]/95">Appearance</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
              <FancySelect
                label="Color (Ext)"
                options={COLOR_OPTIONS}
                value={color}
                onChange={onColorChange}
                triggerClassName={modalInputClass}
                labelClassName={modalLabelClass}
              />
              <FancySelect
                label="Transmission"
                options={TRANSMISSION_OPTIONS}
                value={transmission}
                onChange={onTransmissionChange}
                triggerClassName={modalInputClass}
                labelClassName={modalLabelClass}
              />
              <FancySelect
                label="Fuel Type"
                options={FUEL_OPTIONS}
                value={fuelType}
                onChange={onFuelTypeChange}
                triggerClassName={modalInputClass}
                labelClassName={modalLabelClass}
              />
              <Input
                label="Engine"
                value={engine}
                onChange={(e) => onEngineChange(e.target.value)}
                placeholder="e.g. 5.3L V8"
                className={modalInputClass}
                labelClassName={modalLabelClass}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DMSCard className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <DMSCardHeader className="border-b border-[var(--border)] bg-[var(--surface-2)] px-6 pt-4 pb-3">
        <DMSCardTitle className="text-[15px] font-semibold text-[var(--text)]">Vehicle Details</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className="px-5 pt-6 pb-5 space-y-3">
        <>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[120px] flex-1">
                <Input
                  label="Stock #"
                  value={stockNumber}
                  onChange={(e) => onStockNumberChange(e.target.value)}
                  error={errors.stockNumber}
                />
              </div>
              {onDecodeStock && (
                <Button type="button" variant="secondary" size="sm" onClick={onDecodeStock} aria-label="Decode from barcode">
                  <BarcodeIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Input
              label="Year (VIN)"
              value={vinDisplay}
              readOnly
              disabled
              className="text-[var(--text-soft)]"
            />
            <Input
              label="Year (Model Year)"
              value={year}
              onChange={(e) => onYearChange(e.target.value)}
              placeholder="e.g. 2021"
              className={yearDecoded ? decodedInputClass : undefined}
              error={errors.year}
            />
            <Input
              label="Make"
              value={make}
              onChange={(e) => onMakeChange(e.target.value)}
              className={makeDecoded ? decodedInputClass : undefined}
              error={errors.make}
            />
            <Input
              label="Model"
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              className={modelDecoded ? decodedInputClass : undefined}
              error={errors.model}
            />
            <Input label="Trim" value={trim} onChange={(e) => onTrimChange(e.target.value)} placeholder="e.g. LTZ AWD" />
            <Input
              label="Mileage"
              value={mileage}
              onChange={(e) => onMileageChange(e.target.value)}
                placeholder="e.g. 50412"
                error={errors.mileage}
              />
        </>
        {!compact ? (
          <details className="group border-t border-[var(--border)] pt-2">
            <summary className="cursor-pointer list-none text-sm font-medium text-[var(--text)] before:mr-2 before:inline-block before:content-[''] [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <ChevronIcon className="h-4 w-4 shrink-0 text-[var(--text-soft)] transition-transform group-open:rotate-90" />
                Advanced details
              </span>
            </summary>
            <div className="space-y-2 pt-2">
              <Select
                label="Color (Ext)"
                options={COLOR_OPTIONS}
                value={color}
                onChange={onColorChange}
              />
              <Select
                label="Body Style"
                options={BODY_STYLE_OPTIONS}
                value={bodyStyle}
                onChange={onBodyStyleChange}
              />
              <Select
                label="Transmission"
                options={TRANSMISSION_OPTIONS}
                value={transmission}
                onChange={onTransmissionChange}
              />
              <Select
                label="Fuel Type"
                options={FUEL_OPTIONS}
                value={fuelType}
                onChange={onFuelTypeChange}
              />
              <Input
                label="Engine"
                value={engine}
                onChange={(e) => onEngineChange(e.target.value)}
                placeholder="e.g. 5.3L V8"
              />
            </div>
          </details>
        ) : null}
      </DMSCardContent>
    </DMSCard>
  );
}

function BarcodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 5v14" />
      <path d="M8 5v14" />
      <path d="M12 5v14" />
      <path d="M17 5v14" />
      <path d="M21 5v14" />
      <path d="M5 3h2v4H5z" />
      <path d="M9 3h1v4H9z" />
      <path d="M14 3h1v4h-1z" />
      <path d="M18 3h2v4h-2z" />
    </svg>
  );
}

function BasicsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16" />
      <path d="M4 12h10" />
      <path d="M4 18h16" />
      <path d="M18 10h2v4h-2z" />
    </svg>
  );
}

function SpecsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9h10" />
      <path d="M7 13h6" />
    </svg>
  );
}

function AppearanceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 16V8l4-2h6l4 2v8" />
      <path d="M3 16h18" />
      <circle cx="7" cy="16" r="1.5" />
      <circle cx="17" cy="16" r="1.5" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
