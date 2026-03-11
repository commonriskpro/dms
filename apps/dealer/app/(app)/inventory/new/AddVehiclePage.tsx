"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { useSession } from "@/contexts/session-context";
import { PageShell } from "@/components/ui/page-shell";
import { Widget } from "@/components/ui-system/widgets/Widget";
import { parseDollarsToCents, formatCents } from "@/lib/money";
import { inventoryDetailPath } from "@/lib/routes/detail-paths";
import { cn } from "@/lib/utils";
import { typography } from "@/lib/ui/tokens";
import type { VehicleCostTotalsResponse } from "@/modules/inventory/ui/types";
import { CostsTabContent } from "@/modules/inventory/ui/components/CostsTabContent";
import {
  addVehicleFormSchema,
  type AddVehicleFormValues,
} from "./addVehicle.schema";
import { VinDecodeBar } from "./components/VinDecodeBar";
import { VehicleDetailsCard } from "./components/VehicleDetailsCard";
import { PricingProfitCard } from "./components/PricingProfitCard";
import { PhotosStatusCard } from "./components/PhotosStatusCard";
import { AddVehicleFooter } from "./components/AddVehicleFooter";

const DRAFT_KEY = "addVehicleDraft";

const BODY_STYLE_MAP: [RegExp, string][] = [
  [/suv|sport.?utility/i, "SUV"],
  [/truck|pickup/i, "Truck"],
  [/sedan/i, "Sedan"],
  [/coupe/i, "Coupe"],
  [/van|minivan|cargo/i, "Van"],
  [/hatchback|liftback/i, "Hatchback"],
];

const TRANSMISSION_MAP: [RegExp, string][] = [
  [/manual/i, "Manual"],
  [/cvt|variable/i, "CVT"],
  [/dct|dual.?clutch/i, "DCT"],
  [/auto/i, "Automatic"],
];

const FUEL_MAP: [RegExp, string][] = [
  [/diesel/i, "Diesel"],
  [/electric/i, "Electric"],
  [/hybrid|phev/i, "Hybrid"],
  [/gasoline/i, "Gasoline"],
  [/gas|flex|petrol/i, "Gas"],
];

function normalizeDecoded(raw: string, map: [RegExp, string][]): string {
  for (const [re, value] of map) {
    if (re.test(raw)) return value;
  }
  return raw;
}

function getCentsFromDollars(dollarStr: string): number {
  const s = parseDollarsToCents(dollarStr);
  if (s === "" || s === "-") return 0;
  return parseInt(s, 10) || 0;
}

type DraftStatus = "idle" | "creating" | "ready" | "error";

type PersistedDraftPayload = {
  draftVehicleId?: string | null;
  vin: string;
  stockNumber: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  mileage: string;
  color: string;
  bodyStyle: string;
  transmission: string;
  fuelType: string;
  engine: string;
  status: string;
  floorplan: string;
  salePriceDollars: string;
  postOnline: boolean;
  postFacebook: boolean;
  postWebsite: boolean;
  postMarketplace: boolean;
  notes: string;
};

export function AddVehiclePage({
  autoFocusVin = false,
  mode = "page",
}: {
  autoFocusVin?: boolean;
  mode?: "page" | "modal";
} = {}) {
  const router = useRouter();
  const { addToast } = useToast();
  const { hasPermission } = useSession();
  const canRead = hasPermission("inventory.read");
  const canWrite = hasPermission("inventory.write");

  const [vin, setVin] = React.useState("");
  const [stockNumber, setStockNumber] = React.useState("");
  const [year, setYear] = React.useState("");
  const [make, setMake] = React.useState("");
  const [model, setModel] = React.useState("");
  const [trim, setTrim] = React.useState("");
  const [mileage, setMileage] = React.useState("");
  const [color, setColor] = React.useState("");
  const [bodyStyle, setBodyStyle] = React.useState("");
  const [transmission, setTransmission] = React.useState("");
  const [fuelType, setFuelType] = React.useState("");
  const [engine, setEngine] = React.useState("");
  const [status, setStatus] = React.useState("AVAILABLE");
  const [floorplan, setFloorplan] = React.useState("");
  const [salePriceDollars, setSalePriceDollars] = React.useState("");
  const [postOnline, setPostOnline] = React.useState(true);
  const [postFacebook, setPostFacebook] = React.useState(true);
  const [postWebsite, setPostWebsite] = React.useState(true);
  const [postMarketplace, setPostMarketplace] = React.useState(true);
  const [notes, setNotes] = React.useState("");
  const [photoUrls, setPhotoUrls] = React.useState<string[]>([]);

  const [vinDecoded, setVinDecoded] = React.useState(false);
  const [vinDecodeLoading, setVinDecodeLoading] = React.useState(false);
  const [vinDecodeError, setVinDecodeError] = React.useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<string, string>>>({});
  const [draftVehicleId, setDraftVehicleId] = React.useState<string | null>(null);
  const [draftStatus, setDraftStatus] = React.useState<DraftStatus>("idle");
  const [draftError, setDraftError] = React.useState<string | null>(null);
  const [ledgerSummary, setLedgerSummary] = React.useState<VehicleCostTotalsResponse["data"] | null>(null);
  const draftCreatePromiseRef = React.useRef<Promise<string> | null>(null);
  const lastDraftSyncRef = React.useRef<string | null>(null);

  const formSnapshotRef = React.useRef({
    vin,
    stockNumber,
    year,
    make,
    model,
    trim,
    mileage,
    color,
    bodyStyle,
    transmission,
    fuelType,
    engine,
    status,
    floorplan,
    salePriceDollars,
    postOnline,
    postFacebook,
    postWebsite,
    postMarketplace,
    notes,
  });
  formSnapshotRef.current = {
    vin,
    stockNumber,
    year,
    make,
    model,
    trim,
    mileage,
    color,
    bodyStyle,
    transmission,
    fuelType,
    engine,
    status,
    floorplan,
    salePriceDollars,
    postOnline,
    postFacebook,
    postWebsite,
    postMarketplace,
    notes,
  };

  const ledgerTotalCostCents = ledgerSummary?.totalInvestedCents
    ? Number(ledgerSummary.totalInvestedCents)
    : 0;
  const totalCostCents = ledgerTotalCostCents;
  const salePriceCents = getCentsFromDollars(salePriceDollars);
  const projectedProfitCents = salePriceCents - totalCostCents;
  const profitPct =
    totalCostCents > 0 && salePriceCents > 0
      ? Math.round((projectedProfitCents / totalCostCents) * 100)
      : null;
  const publishTargets = [postOnline, postFacebook, postWebsite, postMarketplace].filter(Boolean).length;
  const intakeFieldsComplete = [
    stockNumber.trim(),
    year.trim(),
    make.trim(),
    model.trim(),
    salePriceDollars.trim(),
  ].filter(Boolean).length;
  const identityReady = [stockNumber.trim(), year.trim(), make.trim(), model.trim()].every(Boolean);
  const pricingReady = salePriceDollars.trim().length > 0;
  const merchandisingReady = photoUrls.length > 0;
  const isModal = mode === "modal";
  const progressItems = [
    {
      key: "identity",
      title: "Identity",
      ready: identityReady,
    },
    {
      key: "pricing",
      title: "Pricing",
      ready: pricingReady,
    },
    {
      key: "merchandising",
      title: "Merchandising",
      ready: merchandisingReady,
    },
  ] as const;
  const footerSummary = !stockNumber.trim()
    ? "Assign a stock number before you create the vehicle."
    : !salePriceDollars.trim()
      ? "Set a sale price to expose the margin before creating the record."
      : `Projected gross ${formatCents(String(projectedProfitCents))} with ${photoUrls.length} photo${photoUrls.length === 1 ? "" : "s"} attached.`;
  const footerMetrics = [
    { label: "complete", value: `${intakeFieldsComplete}/5` },
    { label: "gross", value: formatCents(String(projectedProfitCents)) },
    { label: "status", value: status || "Unset" },
    { label: "photos", value: String(photoUrls.length) },
    { label: "targets", value: String(publishTargets) },
  ];

  const buildPersistedDraftPayload = React.useCallback(
    (nextDraftVehicleId?: string | null): PersistedDraftPayload => ({
      draftVehicleId: nextDraftVehicleId ?? draftVehicleId,
      vin,
      stockNumber,
      year,
      make,
      model,
      trim,
      mileage,
      color,
      bodyStyle,
      transmission,
      fuelType,
      engine,
      status,
      floorplan,
      salePriceDollars,
      postOnline,
      postFacebook,
      postWebsite,
      postMarketplace,
      notes,
    }),
    [
      bodyStyle,
      color,
      draftVehicleId,
      engine,
      floorplan,
      fuelType,
      make,
      mileage,
      model,
      notes,
      postFacebook,
      postMarketplace,
      postOnline,
      postWebsite,
      salePriceDollars,
      status,
      stockNumber,
      transmission,
      trim,
      vin,
      year,
    ]
  );

  const persistLocalDraft = React.useCallback(
    (nextDraftVehicleId?: string | null) => {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify(buildPersistedDraftPayload(nextDraftVehicleId))
      );
    },
    [buildPersistedDraftPayload]
  );

  const clearLocalDraft = React.useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
  }, []);

  const buildVehiclePersistBody = React.useCallback(
    (
      values: Pick<
        AddVehicleFormValues,
        "vin" | "stockNumber" | "year" | "make" | "model" | "trim" | "mileage" | "color" | "status" | "salePriceDollars"
      >
    ) => {
      const body: Record<string, unknown> = {};
      if (values.vin !== undefined) body.vin = values.vin;
      if (values.stockNumber?.trim()) body.stockNumber = values.stockNumber.trim();
      if (typeof values.year === "number" && !Number.isNaN(values.year)) body.year = values.year;
      if (values.make !== undefined) body.make = values.make;
      if (values.model !== undefined) body.model = values.model;
      if (values.trim !== undefined) body.trim = values.trim;
      if (typeof values.mileage === "number" && !Number.isNaN(values.mileage)) body.mileage = values.mileage;
      if (values.color !== undefined) body.color = values.color;
      if (values.status !== undefined) body.status = values.status;
      if (values.salePriceDollars !== undefined) {
        const cents = parseDollarsToCents(values.salePriceDollars);
        if (cents !== "") body.salePriceCents = cents;
      }
      return body;
    },
    []
  );

  const buildCurrentVehiclePersistBody = React.useCallback(
    () =>
      buildVehiclePersistBody({
        vin: vin || undefined,
        stockNumber,
        year: year === "" ? undefined : Number(year),
        make: make || undefined,
        model: model || undefined,
        trim: trim || undefined,
        mileage: mileage === "" ? undefined : Number(mileage),
        color: color || undefined,
        status: (status as AddVehicleFormValues["status"]) || undefined,
        salePriceDollars: salePriceDollars || undefined,
      }),
    [buildVehiclePersistBody, color, make, mileage, model, salePriceDollars, status, stockNumber, trim, vin, year]
  );

  const loadDraft = React.useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<PersistedDraftPayload>;
      const setStr = (v: string | boolean | undefined, set: (s: string) => void) => {
        if (typeof v === "string") set(v);
      };
      if (typeof d.draftVehicleId === "string" && d.draftVehicleId.trim()) {
        setDraftVehicleId(d.draftVehicleId);
        setDraftStatus("ready");
      }
      setStr(d.vin, setVin);
      setStr(d.stockNumber, setStockNumber);
      if (d.year != null) setYear(String(d.year));
      setStr(d.make, setMake);
      setStr(d.model, setModel);
      setStr(d.trim, setTrim);
      if (d.mileage != null) setMileage(String(d.mileage));
      setStr(d.color, setColor);
      setStr(d.bodyStyle, setBodyStyle);
      setStr(d.transmission, setTransmission);
      setStr(d.fuelType, setFuelType);
      setStr(d.engine, setEngine);
      setStr(d.status, setStatus);
      setStr(d.floorplan, setFloorplan);
      setStr(d.salePriceDollars, setSalePriceDollars);
      if (typeof d.postOnline === "boolean") setPostOnline(d.postOnline);
      if (typeof d.postFacebook === "boolean") setPostFacebook(d.postFacebook);
      if (typeof d.postWebsite === "boolean") setPostWebsite(d.postWebsite);
      if (typeof d.postMarketplace === "boolean") setPostMarketplace(d.postMarketplace);
      setStr(d.notes, setNotes);
    } catch {
      // ignore invalid draft
    }
  }, []);

  React.useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  React.useEffect(() => {
    if (!draftVehicleId) {
      setLedgerSummary(null);
      return;
    }
    void apiFetch<VehicleCostTotalsResponse>(`/api/inventory/${draftVehicleId}/cost`)
      .then((response) => setLedgerSummary(response.data))
      .catch(() => undefined);
  }, [draftVehicleId]);

  const ensureDraftVehicle = React.useCallback(async () => {
    if (draftVehicleId) return draftVehicleId;
    if (draftCreatePromiseRef.current) return draftCreatePromiseRef.current;
    setDraftStatus("creating");
    setDraftError(null);
    const promise = apiFetch<{ data: { id: string } }>("/api/inventory/draft", {
      method: "POST",
      body: JSON.stringify(buildCurrentVehiclePersistBody()),
    })
      .then((res) => {
        const nextId = res.data.id;
        setDraftVehicleId(nextId);
        setDraftStatus("ready");
        persistLocalDraft(nextId);
        return nextId;
      })
      .catch((error) => {
        const message = getApiErrorMessage(error);
        setDraftStatus("error");
        setDraftError(message);
        throw error;
      })
      .finally(() => {
        draftCreatePromiseRef.current = null;
      });
    draftCreatePromiseRef.current = promise;
    return promise;
  }, [buildCurrentVehiclePersistBody, draftVehicleId, persistLocalDraft]);

  const syncDraftVehicle = React.useCallback(
    async (vehicleId: string, options?: { finalize?: boolean }) => {
      const body = {
        ...buildCurrentVehiclePersistBody(),
        isDraft: options?.finalize ? false : true,
      };
      const signature = JSON.stringify(body);
      if (!options?.finalize && lastDraftSyncRef.current === signature) return;
      await apiFetch(`/api/inventory/${vehicleId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      lastDraftSyncRef.current = signature;
      if (!options?.finalize) {
        setDraftStatus("ready");
        setDraftError(null);
        persistLocalDraft(vehicleId);
      }
    },
    [buildCurrentVehiclePersistBody, persistLocalDraft]
  );

  React.useEffect(() => {
    if (draftVehicleId) return;
    const timeout = window.setTimeout(() => {
      void ensureDraftVehicle().catch(() => undefined);
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [draftVehicleId, ensureDraftVehicle]);

  React.useEffect(() => {
    if (!draftVehicleId) return;
    const timeout = window.setTimeout(() => {
      void syncDraftVehicle(draftVehicleId).catch((error) => {
        setDraftStatus("error");
        setDraftError(getApiErrorMessage(error));
      });
    }, 750);
    return () => window.clearTimeout(timeout);
  }, [
    color,
    draftVehicleId,
    make,
    mileage,
    model,
    salePriceDollars,
    status,
    stockNumber,
    trim,
    syncDraftVehicle,
    vin,
    year,
  ]);

  const resetForm = React.useCallback(() => {
    clearLocalDraft();
    setDraftVehicleId(null);
    setDraftStatus("idle");
    setDraftError(null);
    setLedgerSummary(null);
    lastDraftSyncRef.current = null;
    setVin("");
    setStockNumber("");
    setYear("");
    setMake("");
    setModel("");
    setTrim("");
    setMileage("");
    setColor("");
    setBodyStyle("");
    setTransmission("");
    setFuelType("");
    setEngine("");
    setStatus("AVAILABLE");
    setFloorplan("");
    setSalePriceDollars("");
    setNotes("");
    setPhotoUrls([]);
    setVinDecoded(false);
    setVinDecodeError(null);
    setErrors({});
  }, [clearLocalDraft]);

  React.useEffect(() => {
    const trimmed = vin.trim();
    if (trimmed.length >= 6) {
      setStockNumber(trimmed.slice(-6).toUpperCase());
    }
  }, [vin]);

  const handleDecodeVin = React.useCallback(async () => {
    const raw = vin.trim();
    if (raw.length < 8 || raw.length > 17) {
      setVinDecodeError("VIN must be 8–17 characters to decode");
      return;
    }
    setVinDecodeError(null);
    setVinDecodeLoading(true);
    try {
      const res = await apiFetch<{
        data: {
          vehicle?: {
            year?: number;
            make?: string;
            model?: string;
            trim?: string;
            bodyStyle?: string;
            engine?: string;
            transmission?: string;
            fuelType?: string;
          };
        };
      }>("/api/inventory/vin-decode", {
        method: "POST",
        body: JSON.stringify({ vin: raw }),
      });
      const v = res.data?.vehicle;
      if (v) {
        if (v.year != null) setYear(String(v.year));
        if (v.make != null) setMake(v.make);
        if (v.model != null) setModel(v.model);
        if (v.trim != null) setTrim(v.trim);
        if (v.bodyStyle != null) setBodyStyle(normalizeDecoded(v.bodyStyle, BODY_STYLE_MAP));
        if (v.engine != null) setEngine(v.engine);
        if (v.transmission != null) setTransmission(normalizeDecoded(v.transmission, TRANSMISSION_MAP));
        if (v.fuelType != null) setFuelType(normalizeDecoded(v.fuelType, FUEL_MAP));
        setVinDecoded(true);
        void ensureDraftVehicle().catch(() => undefined);
        addToast("success", "VIN decoded — specs filled in");
      } else {
        addToast("info", "No decode data returned");
      }
    } catch (e) {
      setVinDecodeError(getApiErrorMessage(e));
      addToast("error", getApiErrorMessage(e));
    } finally {
      setVinDecodeLoading(false);
    }
  }, [ensureDraftVehicle, vin, addToast]);

  const validateAndSubmit = React.useCallback(
    async (afterSuccess: "redirect" | "reset") => {
      const s = formSnapshotRef.current;
      const raw: AddVehicleFormValues = {
        vin: s.vin || undefined,
        stockNumber: s.stockNumber,
        year: s.year === "" ? undefined : Number(s.year),
        make: s.make || undefined,
        model: s.model || undefined,
        trim: s.trim || undefined,
        mileage: s.mileage === "" ? undefined : Number(s.mileage),
        color: s.color || undefined,
        bodyStyle: s.bodyStyle || undefined,
        transmission: s.transmission || undefined,
        fuelType: s.fuelType || undefined,
        status: (s.status as AddVehicleFormValues["status"]) || undefined,
        floorplan: s.floorplan || undefined,
        salePriceDollars: s.salePriceDollars || undefined,
        postOnline: s.postOnline,
        postFacebook: s.postFacebook,
        postWebsite: s.postWebsite,
        postMarketplace: s.postMarketplace,
        notes: s.notes || undefined,
      };
      const parsed = addVehicleFormSchema.safeParse(raw);
      if (!parsed.success) {
        const fieldErrors: Partial<Record<string, string>> = {};
        parsed.error.issues.forEach((issue) => {
          const path = issue.path[0];
          if (typeof path === "string") fieldErrors[path] = issue.message;
        });
        setErrors(fieldErrors);
        addToast("error", "Please fix the errors below.");
        return;
      }
      setErrors({});
      setSubmitLoading(true);
      try {
        const reservedDraftId = await ensureDraftVehicle();
        await syncDraftVehicle(reservedDraftId, { finalize: false });
        const body = {
          ...buildVehiclePersistBody(parsed.data),
          isDraft: false,
        };
        const res = await apiFetch<{ data: { id: string } }>(`/api/inventory/${reservedDraftId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        addToast("success", "Vehicle created");
        clearLocalDraft();
        router.refresh();
        if (afterSuccess === "redirect") {
          router.push(inventoryDetailPath(res.data.id));
        } else {
          resetForm();
        }
      } catch (e) {
        addToast("error", getApiErrorMessage(e));
      } finally {
        setSubmitLoading(false);
      }
    },
    [addToast, buildVehiclePersistBody, clearLocalDraft, ensureDraftVehicle, resetForm, router, syncDraftVehicle]
  );

  const handleCreateVehicle = React.useCallback(() => validateAndSubmit("redirect"), [validateAndSubmit]);
  const handleSaveAndAddAnother = React.useCallback(() => validateAndSubmit("reset"), [validateAndSubmit]);

  const handleSaveDraft = React.useCallback(async () => {
    try {
      const reservedDraftId = await ensureDraftVehicle();
      await syncDraftVehicle(reservedDraftId, { finalize: false });
      persistLocalDraft(reservedDraftId);
      addToast("success", "Draft saved");
    } catch (error) {
      addToast("error", getApiErrorMessage(error) || "Could not save draft");
    }
  }, [addToast, ensureDraftVehicle, persistLocalDraft, syncDraftVehicle]);

  const handleCancel = React.useCallback(() => {
    router.push("/inventory");
  }, [router]);

  if (!canRead) {
    if (isModal) {
      return (
        <div className="p-6">
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="text-[var(--text-soft)]">You don’t have access to inventory.</p>
          </div>
        </div>
      );
    }
    return (
      <PageShell fullWidth contentClassName="px-4 sm:px-6 lg:px-8 min-[1800px]:px-10 min-[2200px]:px-14">
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-[var(--text-soft)]">You don’t have access to inventory.</p>
        </div>
      </PageShell>
    );
  }

  if (!canWrite) {
    if (isModal) {
      return (
        <div className="p-6">
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="text-[var(--text-soft)]">You don’t have permission to add vehicles.</p>
          </div>
        </div>
      );
    }
    return (
      <PageShell fullWidth contentClassName="px-4 sm:px-6 lg:px-8 min-[1800px]:px-10 min-[2200px]:px-14">
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-[var(--text-soft)]">You don’t have permission to add vehicles.</p>
        </div>
      </PageShell>
    );
  }

  const content = (
    <>
      <section
        className={cn(
          "overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)]",
          isModal
            ? "min-h-full"
            : "rounded-[28px] border border-[var(--border)] shadow-[var(--shadow-card)]"
        )}
      >
        <div className={cn("border-b border-[var(--border)]", isModal ? "px-6 py-4 sm:px-8" : "px-5 py-5 sm:px-6")}>
          {isModal ? (
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 xl:w-[260px]">
                <h1 className={cn(typography.pageTitle, "text-[2rem] tracking-[-0.04em] sm:text-[2.35rem]")}>
                  Add vehicle
                </h1>
              </div>
              <div className="min-w-0 flex-1 xl:max-w-[760px]">
                <VinDecodeBar
                  vin={vin}
                  onVinChange={setVin}
                  onDecode={handleDecodeVin}
                  decodeLoading={vinDecodeLoading}
                  error={vinDecodeError}
                  autoFocus={autoFocusVin}
                  inHeader
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <div className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
                  {vinDecoded ? "VIN decoded" : "Manual intake"}
                </div>
                <div className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
                  {publishTargets} publish target{publishTargets === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                    Inventory intake
                  </p>
                  <h1 className={cn(typography.pageTitle, "tracking-[-0.04em]")}>Add vehicle</h1>
                  <p className="max-w-3xl text-sm leading-7 text-[var(--muted-text)]">
                    Move from VIN to a ready-to-create unit record in three steps: identity, pricing, and merchandising.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
                    {vinDecoded ? "VIN decoded" : "Manual intake"}
                  </div>
                  <div className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
                    {publishTargets} publish target{publishTargets === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <VinDecodeBar
                  vin={vin}
                  onVinChange={setVin}
                  onDecode={handleDecodeVin}
                  decodeLoading={vinDecodeLoading}
                  error={vinDecodeError}
                  autoFocus={autoFocusVin}
                />
              </div>
            </>
          )}
        </div>

        <div className={cn("py-5", isModal ? "px-6 sm:px-8" : "px-5 sm:px-6")}>
          <div className={cn("space-y-5", isModal ? "space-y-4" : "space-y-5")}>
            <section className="space-y-3">
              <div className={cn("gap-3", isModal ? "flex flex-wrap items-center justify-between" : "space-y-1")}>
                <div className={cn(isModal ? "min-w-0" : "space-y-1")}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">Step 1</p>
                  <h2 className="text-xl font-semibold text-[var(--text)]">Vehicle identity</h2>
                  {!isModal && (
                    <p className="text-sm leading-6 text-[var(--muted-text)]">
                      Create the unit record from stock, VIN, and base vehicle attributes.
                    </p>
                  )}
                </div>
                {isModal && (
                  <div className="flex flex-wrap items-center gap-2">
                    {progressItems.map((item, index) => (
                      <div
                        key={item.key}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)]/55 px-3 py-1.5 text-xs"
                      >
                        <span className="font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="font-medium text-[var(--text)]">{item.title}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                            item.ready
                              ? "bg-emerald-500/12 text-emerald-300"
                              : "bg-[var(--surface)] text-[var(--text-soft)]"
                          )}
                        >
                          {item.ready ? "Ready" : "Open"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <VehicleDetailsCard
                stockNumber={stockNumber}
                onStockNumberChange={setStockNumber}
                vinDisplay={vin}
                year={year}
                onYearChange={setYear}
                make={make}
                onMakeChange={setMake}
                model={model}
                onModelChange={setModel}
                trim={trim}
                onTrimChange={setTrim}
                mileage={mileage}
                onMileageChange={setMileage}
                color={color}
                onColorChange={setColor}
                bodyStyle={bodyStyle}
                onBodyStyleChange={setBodyStyle}
                transmission={transmission}
                onTransmissionChange={setTransmission}
                fuelType={fuelType}
                onFuelTypeChange={setFuelType}
                engine={engine}
                onEngineChange={setEngine}
                yearDecoded={vinDecoded}
                makeDecoded={vinDecoded}
                modelDecoded={vinDecoded}
                errors={errors}
                compact={isModal}
              />
            </section>

            <div
              className={cn(
                "grid gap-5",
                draftVehicleId && isModal ? "grid-cols-1" : "xl:grid-cols-2"
              )}
            >
              <section className="space-y-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">Step 2</p>
                  <h2 className="text-xl font-semibold text-[var(--text)]">Pricing and ledger</h2>
                  {!isModal && (
                    <p className="text-sm leading-6 text-[var(--muted-text)]">
                      Set asking price on the vehicle and manage acquisition, recon, and fee activity in the shared ledger.
                    </p>
                  )}
                </div>
                <PricingProfitCard
                  salePriceDollars={salePriceDollars}
                  onSalePriceChange={setSalePriceDollars}
                  totalCostCents={totalCostCents}
                  projectedProfitCents={projectedProfitCents}
                  profitPct={profitPct}
                  errors={errors}
                  ledgerTotals={
                    ledgerSummary
                      ? {
                          acquisitionSubtotalCents: Number(ledgerSummary.acquisitionSubtotalCents),
                          transportCents: Number(ledgerSummary.transportCostCents),
                          reconSubtotalCents: Number(ledgerSummary.reconSubtotalCents),
                          feesSubtotalCents: Number(ledgerSummary.feesSubtotalCents),
                          miscCents: Number(ledgerSummary.miscCostCents),
                          totalInvestedCents: Number(ledgerSummary.totalInvestedCents),
                        }
                      : null
                  }
                />
                {draftVehicleId ? (
                  <CostsTabContent
                    vehicleId={draftVehicleId}
                    mode="embedded"
                    showSummaryCards={false}
                    hideEmbeddedHeader
                    showDocuments={!isModal}
                    onDataChange={(snapshot) => setLedgerSummary(snapshot.cost)}
                  />
                ) : draftStatus === "error" ? (
                  <div className="rounded-[20px] border border-dashed border-[var(--danger)]/40 bg-[var(--surface-2)]/30 px-5 py-4">
                    <p className="text-sm font-medium text-[var(--text)]">Ledger unavailable</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--danger)]">
                      {draftError ?? "The draft vehicle could not be created."}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface-2)]/30 px-5 py-4">
                    <p className="text-sm font-medium text-[var(--text)]">Preparing cost ledger…</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted-text)]">
                      Creating the draft vehicle so acquisition, recon, fees, and documents can be tracked from the start.
                    </p>
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">Step 3</p>
                  <h2 className="text-xl font-semibold text-[var(--text)]">Merchandising and status</h2>
                  {!isModal && (
                    <p className="text-sm leading-6 text-[var(--muted-text)]">
                      Attach media, choose publish targets, and set the initial lot posture.
                    </p>
                  )}
                </div>
                <PhotosStatusCard
                  status={status}
                  onStatusChange={setStatus}
                  floorplan={floorplan}
                  onFloorplanChange={setFloorplan}
                  postOnline={postOnline}
                  onPostOnlineChange={setPostOnline}
                  postFacebook={postFacebook}
                  onPostFacebookChange={setPostFacebook}
                  postWebsite={postWebsite}
                  onPostWebsiteChange={setPostWebsite}
                  postMarketplace={postMarketplace}
                  onPostMarketplaceChange={setPostMarketplace}
                  notes={notes}
                  onNotesChange={setNotes}
                  photoUrls={photoUrls}
                  onPhotosChange={setPhotoUrls}
                />
              </section>
            </div>
            {!isModal && (
              <Widget
                title="Create posture"
                subtitle="A compact read on what will happen if you create the record now."
                className="h-fit"
              >
                <div className="space-y-3">
                  <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-2)]/35 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Progress</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{intakeFieldsComplete}/5</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted-text)]">Core identity and pricing checkpoints completed.</p>
                  </div>
                  <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-2)]/35 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Projected gross</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{formatCents(String(projectedProfitCents))}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted-text)]">
                      {profitPct != null ? `${profitPct}% margin at current target.` : "Set a sale price to expose margin."}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-2)]/35 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">If created now</p>
                    <ul className="mt-2 space-y-1.5 text-sm leading-6 text-[var(--muted-text)]">
                      <li>Status: <span className="text-[var(--text)]">{status || "Unassigned"}</span></li>
                      <li>Photos: <span className="text-[var(--text)]">{photoUrls.length}</span></li>
                      <li>Publish targets: <span className="text-[var(--text)]">{publishTargets}</span></li>
                      <li>
                        Ledger invested: <span className="text-[var(--text)]">{formatCents(ledgerSummary?.totalInvestedCents ?? "0")}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </Widget>
            )}
            {isModal && (
              <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface-2)]/35 px-4 py-3">
                <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted-text)]">
                  <span>
                    Progress <span className="font-semibold text-[var(--text)]">{intakeFieldsComplete}/5</span>
                  </span>
                  <span>
                    Gross <span className="font-semibold text-[var(--text)]">{formatCents(String(projectedProfitCents))}</span>
                  </span>
                  <span>
                    Status <span className="font-semibold text-[var(--text)]">{status || "Unset"}</span>
                  </span>
                  <span>
                    Photos <span className="font-semibold text-[var(--text)]">{photoUrls.length}</span>
                  </span>
                  <span>
                    Targets <span className="font-semibold text-[var(--text)]">{publishTargets}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <AddVehicleFooter
        onCancel={handleCancel}
        onSaveDraft={handleSaveDraft}
        onSaveAndAddAnother={handleSaveAndAddAnother}
        onCreateVehicle={handleCreateVehicle}
        createLoading={submitLoading}
        createDisabled={!stockNumber.trim()}
        summary={footerSummary}
        metrics={isModal ? footerMetrics : undefined}
      />
    </>
  );

  if (isModal) {
    return <div className="flex min-h-full flex-col bg-[var(--surface)]">{content}</div>;
  }

  return (
    <PageShell
      fullWidth
      contentClassName="px-4 sm:px-6 lg:px-8 min-[1800px]:px-10 min-[2200px]:px-14"
      className="flex flex-col gap-4 min-[1800px]:gap-5"
    >
      {content}
    </PageShell>
  );
}
