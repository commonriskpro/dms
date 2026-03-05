"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { useSession } from "@/contexts/session-context";
import { parseDollarsToCents } from "@/lib/money";
import {
  addVehicleFormSchema,
  addVehicleFormToApiBody,
  type AddVehicleFormValues,
} from "./addVehicle.schema";
import { VinDecodeBar } from "./components/VinDecodeBar";
import { VehicleDetailsCard } from "./components/VehicleDetailsCard";
import { PricingProfitCard } from "./components/PricingProfitCard";
import { PhotosStatusCard } from "./components/PhotosStatusCard";
import { AddVehicleFooter } from "./components/AddVehicleFooter";

const DRAFT_KEY = "addVehicleDraft";

const RECON_WARNING_THRESHOLD_CENTS = 5000; // $50

function getCentsFromDollars(dollarStr: string): number {
  const s = parseDollarsToCents(dollarStr);
  if (s === "" || s === "-") return 0;
  return parseInt(s, 10) || 0;
}

export function AddVehiclePage() {
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
  const [status, setStatus] = React.useState("AVAILABLE");
  const [floorplan, setFloorplan] = React.useState("");
  const [auctionCostDollars, setAuctionCostDollars] = React.useState("");
  const [transportCostDollars, setTransportCostDollars] = React.useState("");
  const [reconCostDollars, setReconCostDollars] = React.useState("");
  const [miscCostDollars, setMiscCostDollars] = React.useState("");
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
    status,
    floorplan,
    auctionCostDollars,
    transportCostDollars,
    reconCostDollars,
    miscCostDollars,
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
    status,
    floorplan,
    auctionCostDollars,
    transportCostDollars,
    reconCostDollars,
    miscCostDollars,
    salePriceDollars,
    postOnline,
    postFacebook,
    postWebsite,
    postMarketplace,
    notes,
  };

  const totalCostCents =
    getCentsFromDollars(auctionCostDollars) +
    getCentsFromDollars(transportCostDollars) +
    getCentsFromDollars(reconCostDollars) +
    getCentsFromDollars(miscCostDollars);
  const salePriceCents = getCentsFromDollars(salePriceDollars);
  const projectedProfitCents = salePriceCents - totalCostCents;
  const profitPct =
    totalCostCents > 0 && salePriceCents > 0
      ? Math.round((projectedProfitCents / totalCostCents) * 100)
      : null;
  const reconCostWarning =
    getCentsFromDollars(reconCostDollars) >= RECON_WARNING_THRESHOLD_CENTS;

  const loadDraft = React.useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<Record<string, string | boolean>>;
      const setStr = (v: string | boolean | undefined, set: (s: string) => void) => {
        if (typeof v === "string") set(v);
      };
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
      setStr(d.status, setStatus);
      setStr(d.floorplan, setFloorplan);
      setStr(d.auctionCostDollars, setAuctionCostDollars);
      setStr(d.transportCostDollars, setTransportCostDollars);
      setStr(d.reconCostDollars, setReconCostDollars);
      setStr(d.miscCostDollars, setMiscCostDollars);
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
        data: { vehicle?: { year?: number; make?: string; model?: string; trim?: string } };
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
        setVinDecoded(true);
        addToast("success", "VIN decoded — year, make, model, trim filled in");
      } else {
        addToast("info", "No decode data returned");
      }
    } catch (e) {
      setVinDecodeError(getApiErrorMessage(e));
      addToast("error", getApiErrorMessage(e));
    } finally {
      setVinDecodeLoading(false);
    }
  }, [vin, addToast]);

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
        auctionCostDollars: s.auctionCostDollars || undefined,
        transportCostDollars: s.transportCostDollars || undefined,
        reconCostDollars: s.reconCostDollars || undefined,
        miscCostDollars: s.miscCostDollars || undefined,
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
        const body = addVehicleFormToApiBody(parsed.data);
        const res = await apiFetch<{ data: { id: string } }>("/api/inventory", {
          method: "POST",
          body: JSON.stringify(body),
        });
        addToast("success", "Vehicle created");
        if (afterSuccess === "redirect") {
          router.push(`/inventory/${res.data.id}`);
        } else {
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
          setStatus("AVAILABLE");
          setFloorplan("");
          setAuctionCostDollars("");
          setTransportCostDollars("");
          setReconCostDollars("");
          setMiscCostDollars("");
          setSalePriceDollars("");
          setNotes("");
          setVinDecoded(false);
          setErrors({});
        }
      } catch (e) {
        addToast("error", getApiErrorMessage(e));
      } finally {
        setSubmitLoading(false);
      }
    },
    [router, addToast]
  );

  const handleCreateVehicle = React.useCallback(() => validateAndSubmit("redirect"), [validateAndSubmit]);
  const handleSaveAndAddAnother = React.useCallback(() => validateAndSubmit("reset"), [validateAndSubmit]);

  const handleSaveDraft = React.useCallback(() => {
    const payload = {
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
      status,
      floorplan,
      auctionCostDollars,
      transportCostDollars,
      reconCostDollars,
      miscCostDollars,
      salePriceDollars,
      postOnline,
      postFacebook,
      postWebsite,
      postMarketplace,
      notes,
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      addToast("success", "Draft saved");
    } catch {
      addToast("error", "Could not save draft");
    }
  }, [
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
    status,
    floorplan,
    auctionCostDollars,
    transportCostDollars,
    reconCostDollars,
    miscCostDollars,
    salePriceDollars,
    postOnline,
    postFacebook,
    postWebsite,
    postMarketplace,
    notes,
    addToast,
  ]);

  const handleCancel = React.useCallback(() => {
    router.push("/inventory");
  }, [router]);

  if (!canRead) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-[var(--text-soft)]">You don’t have access to inventory.</p>
      </div>
    );
  }

  if (!canWrite) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-[var(--text-soft)]">You don’t have permission to add vehicles.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-6 pb-24">
      <h1 className="text-[24px] font-semibold leading-tight text-[var(--text)]">
        Add Vehicle
      </h1>
      <VinDecodeBar
        vin={vin}
        onVinChange={setVin}
        onDecode={handleDecodeVin}
        onScan={() => {}}
        decodeLoading={vinDecodeLoading}
        error={vinDecodeError}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
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
            yearDecoded={vinDecoded}
            makeDecoded={vinDecoded}
            modelDecoded={vinDecoded}
            errors={errors}
          />
        </div>
        <div className="lg:col-span-1">
          <PricingProfitCard
            auctionCostDollars={auctionCostDollars}
            onAuctionCostChange={setAuctionCostDollars}
            transportCostDollars={transportCostDollars}
            onTransportCostChange={setTransportCostDollars}
            reconCostDollars={reconCostDollars}
            onReconCostChange={setReconCostDollars}
            miscCostDollars={miscCostDollars}
            onMiscCostChange={setMiscCostDollars}
            salePriceDollars={salePriceDollars}
            onSalePriceChange={setSalePriceDollars}
            totalCostCents={totalCostCents}
            projectedProfitCents={projectedProfitCents}
            profitPct={profitPct}
            reconCostWarning={reconCostWarning}
            errors={errors}
          />
        </div>
        <div className="lg:col-span-1">
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
            onUploadPhotos={() => {}}
          />
        </div>
      </div>
      <AddVehicleFooter
        onCancel={handleCancel}
        onSaveDraft={handleSaveDraft}
        onSaveAndAddAnother={handleSaveAndAddAnother}
        onCreateVehicle={handleCreateVehicle}
        createLoading={submitLoading}
        createDisabled={!stockNumber.trim()}
      />
    </div>
  );
}
