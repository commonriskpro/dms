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
  vin: z.string().min(1, "VIN required").max(17),
  sourceType: z.enum(["AUCTION", "TRADE_IN", "MARKETPLACE", "STREET"]),
  sellerName: z.string().optional(),
  sellerPhone: z.string().optional(),
  sellerEmail: z.string().optional(),
  askingPriceCents: z.string().optional(),
  negotiatedPriceCents: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const SOURCE_OPTIONS: SelectOption[] = [
  { value: "AUCTION", label: "Auction" },
  { value: "TRADE_IN", label: "Trade-in" },
  { value: "MARKETPLACE", label: "Marketplace" },
  { value: "STREET", label: "Street" },
];

function toCents(s: string | undefined): string | undefined {
  if (s == null || s === "") return undefined;
  const parsed = parseDollarsToCents(s);
  return parsed === "" ? undefined : parsed;
}

export type AcquisitionLeadFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function AcquisitionLeadForm({ open, onOpenChange, onSuccess }: AcquisitionLeadFormProps) {
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
      sourceType: "AUCTION",
      sellerName: "",
      sellerPhone: "",
      sellerEmail: "",
      askingPriceCents: "",
      negotiatedPriceCents: "",
    },
  });

  React.useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      await apiFetch("/api/inventory/acquisition", {
        method: "POST",
        body: JSON.stringify({
          vin: data.vin.trim(),
          sourceType: data.sourceType,
          sellerName: data.sellerName || undefined,
          sellerPhone: data.sellerPhone || undefined,
          sellerEmail: data.sellerEmail || undefined,
          askingPriceCents: toCents(data.askingPriceCents),
          negotiatedPriceCents: toCents(data.negotiatedPriceCents),
        }),
      });
      addToast("success", "Lead created");
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
        <DialogTitle className="text-[var(--text)]">Create acquisition lead</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="lead-vin" className="text-[var(--text)]">VIN</Label>
            <Input
              id="lead-vin"
              {...register("vin")}
              placeholder="17 characters"
              className="mt-1 border-[var(--border)] bg-[var(--surface)] font-mono"
            />
            {errors.vin && (
              <p className="mt-1 text-sm text-[var(--danger)]">{errors.vin.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="lead-sourceType" className="text-[var(--text)]">Source</Label>
            <Select
              id="lead-sourceType"
              value={watch("sourceType")}
              onChange={(v) => setValue("sourceType", v as FormValues["sourceType"])}
              options={SOURCE_OPTIONS}
              className="mt-1"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="lead-sellerName" className="text-[var(--text)]">Seller name</Label>
            <Input
              id="lead-sellerName"
              {...register("sellerName")}
              className="mt-1 border-[var(--border)] bg-[var(--surface)]"
            />
          </div>
          <div>
            <Label htmlFor="lead-askingPrice" className="text-[var(--text)]">Asking price</Label>
            <Input
              id="lead-askingPrice"
              {...register("askingPriceCents")}
              placeholder="$0.00"
              className="mt-1 border-[var(--border)] bg-[var(--surface)]"
            />
          </div>
          <div>
            <Label htmlFor="lead-sellerPhone" className="text-[var(--text)]">Seller phone</Label>
            <Input
              id="lead-sellerPhone"
              {...register("sellerPhone")}
              className="mt-1 border-[var(--border)] bg-[var(--surface)]"
            />
          </div>
          <div>
            <Label htmlFor="lead-negotiatedPrice" className="text-[var(--text)]">Negotiated price</Label>
            <Input
              id="lead-negotiatedPrice"
              {...register("negotiatedPriceCents")}
              placeholder="$0.00"
              className="mt-1 border-[var(--border)] bg-[var(--surface)]"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="lead-sellerEmail" className="text-[var(--text)]">Seller email</Label>
            <Input
              id="lead-sellerEmail"
              {...register("sellerEmail")}
              type="email"
              className="mt-1 border-[var(--border)] bg-[var(--surface)]"
            />
          </div>
        </div>
        <DialogFooter>
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
            className="bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
          >
            {submitting ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
