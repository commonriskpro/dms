"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import type { DateRangePreset } from "@/lib/reports/date-range";
import {
  REPORT_DATE_PRESETS,
  getDateRangeForPreset,
  REPORTS_DEFAULT_TIMEZONE,
} from "@/lib/reports/date-range";

export interface DateRangePickerProps {
  from: string;
  to: string;
  preset: DateRangePreset;
  customFrom?: string;
  customTo?: string;
  onRangeChange: (params: {
    from: string;
    to: string;
    preset: DateRangePreset;
    customFrom?: string;
    customTo?: string;
  }) => void;
  timezone?: string;
}

const presetOptions: SelectOption[] = REPORT_DATE_PRESETS.map((p) => ({
  value: p.value,
  label: p.label,
}));

export function DateRangePicker({
  from,
  to,
  preset,
  customFrom = "",
  customTo = "",
  onRangeChange,
  timezone = REPORTS_DEFAULT_TIMEZONE,
}: DateRangePickerProps) {
  const handlePresetChange = (value: string) => {
    const p = value as DateRangePreset;
    const effectiveFrom = p === "custom" ? customFrom || from : undefined;
    const effectiveTo = p === "custom" ? customTo || to : undefined;
    const range = getDateRangeForPreset(p, effectiveFrom, effectiveTo, timezone);
    onRangeChange({
      from: range.from,
      to: range.to,
      preset: range.preset,
      customFrom: p === "custom" ? range.from : undefined,
      customTo: p === "custom" ? range.to : undefined,
    });
  };

  const handleCustomFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onRangeChange({
      from: preset === "custom" ? v : from,
      to: preset === "custom" ? to : to,
      preset,
      customFrom: v,
      customTo: preset === "custom" ? customTo : undefined,
    });
  };

  const handleCustomToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onRangeChange({
      from: preset === "custom" ? from : from,
      to: preset === "custom" ? v : to,
      preset,
      customFrom: preset === "custom" ? customFrom : undefined,
      customTo: v,
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      <Select
        label="Date range"
        options={presetOptions}
        value={preset}
        onChange={handlePresetChange}
        aria-label="Date range preset"
      />
      {preset === "custom" && (
        <>
          <Input
            type="date"
            label="From"
            value={customFrom}
            onChange={handleCustomFromChange}
            aria-label="Custom date from"
          />
          <Input
            type="date"
            label="To"
            value={customTo}
            onChange={handleCustomToChange}
            aria-label="Custom date to"
          />
        </>
      )}
      <span className="text-sm text-[var(--text-soft)]">
        {from} – {to}
      </span>
    </div>
  );
}
