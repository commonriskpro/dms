"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, type SelectOption } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { parseDollarsToCents } from "@/lib/money";
import { formatCents } from "@/lib/money";
import { X } from "@/lib/ui/icons";

const schema = z.object({
  auctionName: z.string().min(1, "Auction name required").max(256),
  lotNumber: z.string().min(1, "Lot number required").max(128),
  purchasePriceCents: z.string().min(1, "Purchase price required"),
  feesCents: z.string().optional(),
  shippingCents: z.string().optional(),
  etaDate: z.string().optional(),
  status: z.enum(["PENDING", "IN_TRANSIT", "RECEIVED", "CANCELLED"]).optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const STATUS_OPTIONS: SelectOption[] = [
  { value: "PENDING", label: "Pending" },
  { value: "IN_TRANSIT", label: "In transit" },
  { value: "RECEIVED", label: "Received" },
  { value: "CANCELLED", label: "Cancelled" },
];

function toCentsStr(s: string | undefined): string | undefined {
  if (s == null || s === "") return undefined;
  const c = parseDollarsToCents(s);
  return c === "" ? undefined : c;
}

export type AuctionPurchaseFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

function MetricCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-3 shadow-[0_16px_40px_rgba(3,8,24,0.24)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted-text)]">
        {label}
      </p>
      <p className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-[var(--text)]">{value}</p>
      <p className="mt-1 text-sm text-[var(--muted-text)]">{sublabel}</p>
    </div>
  );
}

export function AuctionPurchaseForm({ open, onOpenChange, onSuccess }: AuctionPurchaseFormProps) {
  const { addToast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      auctionName: "",
      lotNumber: "",
      purchasePriceCents: "",
      feesCents: "",
      shippingCents: "",
      etaDate: "",
      status: "PENDING",
      notes: "",
    },
  });

  const statusWatch = watch("status");
  const auctionName = watch("auctionName") ?? "";
  const lotNumber = watch("lotNumber") ?? "";
  const purchasePriceInput = watch("purchasePriceCents");
  const feesInput = watch("feesCents");
  const shippingInput = watch("shippingCents");
  const etaDate = watch("etaDate") ?? "";

  const purchasePrice = toCentsStr(purchasePriceInput) ? parseInt(toCentsStr(purchasePriceInput)!, 10) : 0;
  const fees = toCentsStr(feesInput) ? parseInt(toCentsStr(feesInput)!, 10) : 0;
  const shipping = toCentsStr(shippingInput) ? parseInt(toCentsStr(shippingInput)!, 10) : 0;
  const totalCost = purchasePrice + fees + shipping;

  React.useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const onSubmit = React.useCallback(
    async (values: FormValues) => {
      setSubmitting(true);
      try {
        const purchasePriceCents = toCentsStr(values.purchasePriceCents);
        if (purchasePriceCents == null) {
          addToast("error", "Invalid purchase price");
          return;
        }
        await apiFetch("/api/inventory/auction-purchases", {
          method: "POST",
          body: JSON.stringify({
            auctionName: values.auctionName,
            lotNumber: values.lotNumber,
            purchasePriceCents,
            feesCents: toCentsStr(values.feesCents) ?? "0",
            shippingCents: toCentsStr(values.shippingCents) ?? "0",
            etaDate: values.etaDate || null,
            status: values.status ?? "PENDING",
            notes: values.notes || null,
          }),
        });
        addToast("success", "Auction purchase created");
        onSuccess();
        onOpenChange(false);
      } catch (e) {
        addToast("error", getApiErrorMessage(e));
      } finally {
        setSubmitting(false);
      }
    },
    [addToast, onOpenChange, onSuccess]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="relative z-50 w-full max-w-[1180px] max-h-[92vh] overflow-y-auto rounded-[28px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(8,24,54,0.985),rgba(6,18,40,0.985))] p-0 shadow-[0_28px_90px_rgba(2,8,23,0.52)]"
    >
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-col">
          <DialogHeader className="border-b border-[var(--border)] px-6 pb-5 pt-6 sm:px-7">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--muted-text)]">
                  Auction intake
                </p>
                <DialogTitle className="text-[2rem] font-semibold tracking-[-0.04em] text-[var(--text)]">
                  Create auction purchase
                </DialogTitle>
                <p className="max-w-2xl text-sm text-[var(--muted-text)]">
                  Capture the auction unit, landed cost, and receiving status before it enters the rest of the inventory workflow.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--muted-text)] transition-colors hover:text-[var(--text)]"
                aria-label="Close auction purchase modal"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
          </DialogHeader>

          <div className="space-y-6 px-6 py-6 sm:px-7">
            <div className="grid gap-4 lg:grid-cols-4">
              <MetricCard
                label="Purchase"
                value={formatCents(String(purchasePrice))}
                sublabel="Hammer price"
              />
              <MetricCard
                label="Fees"
                value={formatCents(String(fees))}
                sublabel="Auction and buyer fees"
              />
              <MetricCard
                label="Shipping"
                value={formatCents(String(shipping))}
                sublabel="Transport to lot"
              />
              <MetricCard
                label="Landed cost"
                value={formatCents(String(totalCost))}
                sublabel="Purchase plus fees and shipping"
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <section className="rounded-[26px] border border-[var(--border)] bg-[rgba(255,255,255,0.025)] px-5 py-5">
                <div className="mb-5 flex items-end justify-between gap-4 border-b border-[var(--border)] pb-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted-text)]">Auction record</p>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--text)]">Source and lot</h3>
                  </div>
                  <p className="text-sm text-[var(--muted-text)]">Anchor the purchase to the event and lot before assigning downstream handling.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="auctionName">Auction name</Label>
                    <Input
                      id="auctionName"
                      {...register("auctionName")}
                      className="mt-2 h-11 rounded-[16px] border-[var(--border)] bg-[rgba(255,255,255,0.02)]"
                      placeholder="e.g. Manheim"
                    />
                    {errors.auctionName ? (
                      <p className="mt-1.5 text-sm text-[var(--destructive)]">{errors.auctionName.message}</p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="lotNumber">Lot number</Label>
                    <Input
                      id="lotNumber"
                      {...register("lotNumber")}
                      className="mt-2 h-11 rounded-[16px] border-[var(--border)] bg-[rgba(255,255,255,0.02)]"
                      placeholder="e.g. 12345"
                    />
                    {errors.lotNumber ? (
                      <p className="mt-1.5 text-sm text-[var(--destructive)]">{errors.lotNumber.message}</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="purchasePriceCents">Purchase price ($)</Label>
                    <Input
                      id="purchasePriceCents"
                      type="text"
                      {...register("purchasePriceCents")}
                      className="mt-2 h-11 rounded-[16px] border-[var(--border)] bg-[rgba(255,255,255,0.02)]"
                      placeholder="0.00"
                    />
                    {errors.purchasePriceCents ? (
                      <p className="mt-1.5 text-sm text-[var(--destructive)]">{errors.purchasePriceCents.message}</p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="feesCents">Fees ($)</Label>
                    <Input
                      id="feesCents"
                      type="text"
                      {...register("feesCents")}
                      className="mt-2 h-11 rounded-[16px] border-[var(--border)] bg-[rgba(255,255,255,0.02)]"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shippingCents">Shipping ($)</Label>
                    <Input
                      id="shippingCents"
                      type="text"
                      {...register("shippingCents")}
                      className="mt-2 h-11 rounded-[16px] border-[var(--border)] bg-[rgba(255,255,255,0.02)]"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="etaDate">ETA date</Label>
                    <Input
                      id="etaDate"
                      type="datetime-local"
                      {...register("etaDate")}
                      className="mt-2 h-11 rounded-[16px] border-[var(--border)] bg-[rgba(255,255,255,0.02)]"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-[26px] border border-[var(--border)] bg-[rgba(255,255,255,0.025)] px-5 py-5">
                <div className="mb-5 flex items-end justify-between gap-4 border-b border-[var(--border)] pb-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted-text)]">Receiving context</p>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--text)]">Status and notes</h3>
                  </div>
                  <p className="text-sm text-[var(--muted-text)]">Give the team enough context to know where the unit is and what to expect.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={statusWatch}
                      onChange={(v) => setValue("status", v as FormValues["status"])}
                      options={STATUS_OPTIONS}
                      className="mt-2 h-11 rounded-[16px]"
                    />
                  </div>

                  <div className="rounded-[20px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted-text)]">Current posture</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[11px] text-[var(--muted-text)]">
                        {auctionName.trim() ? "Auction set" : "Auction missing"}
                      </span>
                      <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[11px] text-[var(--muted-text)]">
                        {lotNumber.trim() ? "Lot set" : "Lot missing"}
                      </span>
                      <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[11px] text-[var(--muted-text)]">
                        {STATUS_OPTIONS.find((option) => option.value === statusWatch)?.label ?? "Pending"}
                      </span>
                      <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[11px] text-[var(--muted-text)]">
                        {etaDate ? "ETA scheduled" : "ETA open"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Input
                      id="notes"
                      {...register("notes")}
                      className="mt-2 h-11 rounded-[16px] border-[var(--border)] bg-[rgba(255,255,255,0.02)]"
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 mt-auto flex items-center justify-between gap-4 border-t border-[var(--border)] bg-[rgba(5,16,35,0.94)] px-6 py-4 backdrop-blur sm:px-7">
            <div className="min-w-0">
              <p className="text-sm text-[var(--text)]">The purchase record is only created when you submit.</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[var(--muted-text)]">
                  {auctionName.trim() ? "Auction set" : "Auction missing"}
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[var(--muted-text)]">
                  {STATUS_OPTIONS.find((option) => option.value === statusWatch)?.label ?? "Pending"}
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[var(--muted-text)]">
                  {formatCents(String(totalCost))} landed cost
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create purchase"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
