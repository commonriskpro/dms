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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle className="text-[var(--text)]">Create auction purchase</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 px-6 pb-2">
        <div>
          <Label htmlFor="auctionName">Auction name</Label>
          <Input
            id="auctionName"
            {...register("auctionName")}
            className="mt-1"
            placeholder="e.g. Manheim"
          />
          {errors.auctionName && (
            <p className="mt-1 text-sm text-[var(--destructive)]">{errors.auctionName.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="lotNumber">Lot number</Label>
          <Input
            id="lotNumber"
            {...register("lotNumber")}
            className="mt-1"
            placeholder="e.g. 12345"
          />
          {errors.lotNumber && (
            <p className="mt-1 text-sm text-[var(--destructive)]">{errors.lotNumber.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="purchasePriceCents">Purchase price ($)</Label>
          <Input
            id="purchasePriceCents"
            type="text"
            {...register("purchasePriceCents")}
            className="mt-1"
            placeholder="0.00"
          />
          {errors.purchasePriceCents && (
            <p className="mt-1 text-sm text-[var(--destructive)]">{errors.purchasePriceCents.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="feesCents">Fees ($)</Label>
          <Input
            id="feesCents"
            type="text"
            {...register("feesCents")}
            className="mt-1"
            placeholder="0.00"
          />
        </div>
        <div>
          <Label htmlFor="shippingCents">Shipping ($)</Label>
          <Input
            id="shippingCents"
            type="text"
            {...register("shippingCents")}
            className="mt-1"
            placeholder="0.00"
          />
        </div>
        <div>
          <Label htmlFor="etaDate">ETA date</Label>
          <Input
            id="etaDate"
            type="datetime-local"
            {...register("etaDate")}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={statusWatch}
            onChange={(v) => setValue("status", v as FormValues["status"])}
            options={STATUS_OPTIONS}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" {...register("notes")} className="mt-1" placeholder="Optional" />
        </div>
        <DialogFooter className="mt-4">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
