"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, type SelectOption } from "@/components/ui/select";
import { dashboardCard, spacingTokens } from "@/lib/ui/tokens";
import type { AuctionListingRow } from "./AuctionsPageClient";

const PROVIDER_OPTIONS: SelectOption[] = [{ value: "MOCK", label: "Mock" }];

export type AuctionSearchBarProps = {
  onSearch: (listings: AuctionListingRow[]) => void;
  onSearchStart: () => void;
};

export function AuctionSearchBar({ onSearch, onSearchStart }: AuctionSearchBarProps) {
  const { addToast } = useToast();
  const [vin, setVin] = React.useState("");
  const [make, setMake] = React.useState("");
  const [model, setModel] = React.useState("");
  const [year, setYear] = React.useState("");
  const [provider, setProvider] = React.useState("MOCK");

  const handleSearch = async () => {
    onSearchStart();
    try {
      const params = new URLSearchParams();
      params.set("provider", provider);
      params.set("limit", "25");
      if (vin.trim()) params.set("vin", vin.trim());
      if (make.trim()) params.set("make", make.trim());
      if (model.trim()) params.set("model", model.trim());
      if (year.trim()) params.set("year", year.trim());
      const res = await apiFetch<{ data: AuctionListingRow[] }>(
        `/api/inventory/auctions/search?${params}`
      );
      onSearch(res.data ?? []);
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
      onSearch([]);
    }
  };

  return (
    <div className={`${dashboardCard} ${spacingTokens.cardPad}`}>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[140px]">
          <Label htmlFor="auction-provider" className="text-[var(--muted-text)] text-xs">Provider</Label>
          <Select
            id="auction-provider"
            value={provider}
            onChange={setProvider}
            options={PROVIDER_OPTIONS}
            className="mt-1"
          />
        </div>
        <div className="min-w-[160px]">
          <Label htmlFor="auction-vin" className="text-[var(--muted-text)] text-xs">VIN</Label>
          <Input
            id="auction-vin"
            value={vin}
            onChange={(e) => setVin(e.target.value)}
            placeholder="Optional"
            className="mt-1 border-[var(--border)] bg-[var(--surface)] font-mono"
          />
        </div>
        <div className="min-w-[120px]">
          <Label htmlFor="auction-make" className="text-[var(--muted-text)] text-xs">Make</Label>
          <Input
            id="auction-make"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            placeholder="Optional"
            className="mt-1 border-[var(--border)] bg-[var(--surface)]"
          />
        </div>
        <div className="min-w-[120px]">
          <Label htmlFor="auction-model" className="text-[var(--muted-text)] text-xs">Model</Label>
          <Input
            id="auction-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Optional"
            className="mt-1 border-[var(--border)] bg-[var(--surface)]"
          />
        </div>
        <div className="min-w-[80px]">
          <Label htmlFor="auction-year" className="text-[var(--muted-text)] text-xs">Year</Label>
          <Input
            id="auction-year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="Optional"
            className="mt-1 border-[var(--border)] bg-[var(--surface)]"
          />
        </div>
        <Button
          type="button"
          onClick={handleSearch}
          className="bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
        >
          Search
        </Button>
      </div>
    </div>
  );
}
