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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { parseDollarsToCents } from "@/lib/money";
import { formatCents } from "@/lib/money";

const schema = z.object({
  vin: z.string().min(1, "VIN required").max(17),
  sourceType: z.enum(["TRADE_IN", "AUCTION", "MARKETPLACE", "STREET"]),
  acquisitionCostCents: z.string().optional(),
  reconEstimateCents: z.string().optional(),
  transportEstimateCents: z.string().optional(),
  feesEstimateCents: z.string().optional(),
  expectedRetailCents: z.string().optional(),
  expectedWholesaleCents: z.string().optional(),
  expectedTradeInCents: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const SOURCE_OPTIONS: SelectOption[] = [
  { value: "TRADE_IN", label: "Trade-in" },
  { value: "AUCTION", label: "Auction" },
  { value: "MARKETPLACE", label: "Marketplace" },
  { value: "STREET", label: "Street" },
];

function toCents(s: string | undefined): string | undefined {
  if (s == null || s === "") return undefined;
  const parsed = parseDollarsToCents(s);
  return parsed === "" ? undefined : parsed;
}

export type AppraisalFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function AppraisalForm({ open, onOpenChange, onSuccess }: AppraisalFormProps) {
  const { addToast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vin: "",
      sourceType: "TRADE_IN",
      acquisitionCostCents: "",
      reconEstimateCents: "",
      transportEstimateCents: "",
      feesEstimateCents: "",
      expectedRetailCents: "",
      expectedWholesaleCents: "",
      expectedTradeInCents: "",
      notes: "",
    },
  });

  const acq = watch("acquisitionCostCents");
  const recon = watch("reconEstimateCents");
  const transport = watch("transportEstimateCents");
  const fees = watch("feesEstimateCents");
  const retail = watch("expectedRetailCents");
  const totalCost = [acq, recon, transport, fees].reduce(
    (sum, s) => sum + (toCents(s) ? parseInt(toCents(s)!, 10) : 0),
    0
  );
  const retailCents = toCents(retail) ? parseInt(toCents(retail)!, 10) : 0;
  const expectedProfitCents = Math.max(0, retailCents - totalCost);

  React.useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      await apiFetch("/api/inventory/appraisals", {
        method: "POST",
        body: JSON.stringify({
          vin: data.vin.trim(),
          sourceType: data.sourceType,
          acquisitionCostCents: toCents(data.acquisitionCostCents),
          reconEstimateCents: toCents(data.reconEstimateCents),
          transportEstimateCents: toCents(data.transportEstimateCents),
          feesEstimateCents: toCents(data.feesEstimateCents),
          expectedRetailCents: toCents(data.expectedRetailCents),
          expectedWholesaleCents: toCents(data.expectedWholesaleCents),
          expectedTradeInCents: toCents(data.expectedTradeInCents),
          expectedProfitCents: String(expectedProfitCents),
          notes: data.notes || undefined,
        }),
      });
      addToast("success", "Appraisal created");
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle className="text-[var(--text)]">Create appraisal</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="form-vin" className="text-[var(--text)]">VIN</Label>
            <Input
              id="form-vin"
              {...register("vin")}
              placeholder="17 characters"
              className="mt-1 border-[var(--border)] bg-[var(--surface)] font-mono"
            />
            {errors.vin && (
              <p className="mt-1 text-sm text-[var(--danger)]">{errors.vin.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="form-sourceType" className="text-[var(--text)]">Source</Label>
            <Select
              id="form-sourceType"
              value={watch("sourceType")}
              onChange={(v) => setValue("sourceType", v as FormValues["sourceType"])}
              options={SOURCE_OPTIONS}
              className="mt-1"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="form-acquisitionCost" className="text-[var(--text)]">Acquisition cost</Label>
            <Input
              id="form-acquisitionCost"
              {...register("acquisitionCostCents")}
              placeholder="$0.00"
              className="mt-1 border-[var(--border)] bg-[var(--surface)]"
            />
          </div>
          <div>
            <Label htmlFor="form-reconEstimate" className="text-[var(--text)]">Recon estimate</Label>
            <Input
              id="form-reconEstimate"
              {...register("reconEstimateCents")}
              placeholder="$0.00"
              className="mt-1 border-[var(--border)] bg-[var(--surface)]"
            />
          </div>
          <div>
            <Label htmlFor="form-transportEstimate" className="text-[var(--text)]">Transport estimate</Label>
            <Input
              id="form-transportEstimate"
              {...register("transportEstimateCents")}
              placeholder="$0.00"
              className="mt-1 border-[var(--border)] bg-[var(--surface)]"
            />
          </div>
          <div>
            <Label htmlFor="form-feesEstimate" className="text-[var(--text)]">Fees estimate</Label>
            <Input
              id="form-feesEstimate"
              {...register("feesEstimateCents")}
              placeholder="$0.00"
              className="mt-1 border-[var(--border)] bg-[var(--surface)]"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="form-expectedRetail" className="text-[var(--text)]">Expected retail</Label>
            <Input
              id="form-expectedRetail"
              {...register("expectedRetailCents")}
              placeholder="$0.00"
              className="mt-1 border-[var(--border)] bg-[var(--surface)]"
            />
          </div>
          <div>
            <Label htmlFor="form-expectedWholesale" className="text-[var(--text)]">Expected wholesale</Label>
            <Input
              id="form-expectedWholesale"
              {...register("expectedWholesaleCents")}
              placeholder="$0.00"
              className="mt-1 border-[var(--border)] bg-[var(--surface)]"
            />
          </div>
          <div>
            <Label htmlFor="form-expectedTradeIn" className="text-[var(--text)]">Expected trade-in</Label>
            <Input
              id="form-expectedTradeIn"
              {...register("expectedTradeInCents")}
              placeholder="$0.00"
              className="mt-1 border-[var(--border)] bg-[var(--surface)]"
            />
          </div>
          <div>
            <Label className="text-[var(--text)]">Expected profit (computed)</Label>
            <p className="mt-1 text-sm font-medium text-[var(--text)]">
              {formatCents(String(expectedProfitCents))}
            </p>
          </div>
        </div>
        <div>
          <Label htmlFor="form-notes" className="text-[var(--text)]">Notes</Label>
          <Input
            id="form-notes"
            {...register("notes")}
            placeholder="Optional"
            className="mt-1 border-[var(--border)] bg-[var(--surface)]"
          />
        </div>
        <DialogFooter className="gap-2 border-t border-[var(--border)] pt-4">
          <Button
            type="button"
            variant="secondary"
            className="border-[var(--border)]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
          >
            {submitting ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
