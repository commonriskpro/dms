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
import {
  modalDepthFooterSubtle,
  modalDepthInteractive,
  modalDepthSurface,
  modalDepthSurfaceStrong,
  modalFieldTone,
} from "@/lib/ui/modal-depth";

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
    <div className={`${modalDepthSurfaceStrong} rounded-[24px] px-4 py-3`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted-text)]">
        {label}
      </p>
      <p className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-[var(--text)]">{value}</p>
      <p className="mt-1 text-sm text-[var(--muted-text)]">{sublabel}</p>
    </div>
  );
}

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

  const sellerName = watch("sellerName") ?? "";
  const sellerPhone = watch("sellerPhone") ?? "";
  const sellerEmail = watch("sellerEmail") ?? "";
  const askingInput = watch("askingPriceCents");
  const negotiatedInput = watch("negotiatedPriceCents");
  const askingPrice = toCents(askingInput) ? parseInt(toCents(askingInput)!, 10) : 0;
  const negotiatedPrice = toCents(negotiatedInput)
    ? parseInt(toCents(negotiatedInput)!, 10)
    : 0;
  const spread = Math.max(0, askingPrice - negotiatedPrice);
  const sellerSignals = [
    sellerName.trim() ? "Seller named" : "Seller unnamed",
    sellerPhone.trim() ? "Phone set" : "Phone missing",
    sellerEmail.trim() ? "Email set" : "Email missing",
  ];

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
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="relative z-50 w-full max-w-[1180px] max-h-[92vh] overflow-y-auto rounded-[28px] border border-[color:rgba(148,163,184,0.18)] bg-[color-mix(in_srgb,var(--surface)_92%,rgba(10,20,38,0.72))] p-0 shadow-[0_24px_72px_rgba(2,8,23,0.34)] backdrop-blur"
    >
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-col">
          <DialogHeader className="px-6 pb-4 pt-6 sm:px-7">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--muted-text)]">
                  Acquisition intake
                </p>
                <DialogTitle className="text-[2rem] font-semibold tracking-[-0.04em] text-[var(--text)]">
                  Create acquisition lead
                </DialogTitle>
                <p className="max-w-2xl text-sm text-[var(--muted-text)]">
                  Capture the seller, source channel, and price posture before this unit moves into appraisal or purchase review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.025)] text-[var(--muted-text)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text)]"
                aria-label="Close acquisition lead modal"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
          </DialogHeader>

          <div className="space-y-5 px-6 pb-6 pt-2 sm:px-7">
            <div className="grid gap-4 lg:grid-cols-4">
              <MetricCard
                label="Asking price"
                value={formatCents(String(askingPrice))}
                sublabel="Initial seller expectation"
              />
              <MetricCard
                label="Negotiated"
                value={formatCents(String(negotiatedPrice))}
                sublabel="Current working number"
              />
              <MetricCard
                label="Room"
                value={formatCents(String(spread))}
                sublabel="Gap from ask to negotiated"
              />
              <MetricCard
                label="Source"
                value={SOURCE_OPTIONS.find((option) => option.value === watch("sourceType"))?.label ?? "Auction"}
                sublabel="Lead channel"
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
              <section className={`${modalDepthSurface} rounded-[26px] px-5 py-5`}>
                <div className="mb-5 flex items-end justify-between gap-4 border-b border-[rgba(148,163,184,0.14)] pb-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted-text)]">Vehicle intake</p>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--text)]">Unit and source</h3>
                  </div>
                  <p className="text-sm text-[var(--muted-text)]">Define the unit first so the pipeline knows what this lead refers to.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-[1.3fr_0.9fr]">
                  <div>
                    <Label htmlFor="lead-vin" className="text-[var(--text)]">VIN</Label>
                    <Input
                      id="lead-vin"
                      {...register("vin")}
                      placeholder="17 characters"
                      className={`mt-2 h-11 rounded-[16px] font-mono ${modalFieldTone}`}
                    />
                    {errors.vin ? <p className="mt-1.5 text-sm text-[var(--danger)]">{errors.vin.message}</p> : null}
                  </div>
                  <div>
                    <Label htmlFor="lead-sourceType" className="text-[var(--text)]">Source</Label>
                    <Select
                      id="lead-sourceType"
                      value={watch("sourceType")}
                      onChange={(v) => setValue("sourceType", v as FormValues["sourceType"])}
                      options={SOURCE_OPTIONS}
                      className={`mt-2 h-11 rounded-[16px] ${modalFieldTone}`}
                    />
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="lead-askingPrice" className="text-[var(--text)]">Asking price</Label>
                    <Input
                      id="lead-askingPrice"
                      {...register("askingPriceCents")}
                      placeholder="$0.00"
                      className={`mt-2 h-11 rounded-[16px] ${modalFieldTone}`}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lead-negotiatedPrice" className="text-[var(--text)]">Negotiated price</Label>
                    <Input
                      id="lead-negotiatedPrice"
                      {...register("negotiatedPriceCents")}
                      placeholder="$0.00"
                      className={`mt-2 h-11 rounded-[16px] ${modalFieldTone}`}
                    />
                  </div>
                </div>
              </section>

              <section className={`${modalDepthSurface} rounded-[26px] px-5 py-5`}>
                <div className="mb-5 flex items-end justify-between gap-4 border-b border-[rgba(148,163,184,0.14)] pb-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted-text)]">Seller contact</p>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--text)]">Owner context</h3>
                  </div>
                  <p className="text-sm text-[var(--muted-text)]">Keep just enough contact context to continue the conversation later.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="lead-sellerName" className="text-[var(--text)]">Seller name</Label>
                    <Input
                      id="lead-sellerName"
                      {...register("sellerName")}
                      placeholder="Name or business"
                      className={`mt-2 h-11 rounded-[16px] ${modalFieldTone}`}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lead-sellerPhone" className="text-[var(--text)]">Seller phone</Label>
                    <Input
                      id="lead-sellerPhone"
                      {...register("sellerPhone")}
                      placeholder="(555) 555-1212"
                      className={`mt-2 h-11 rounded-[16px] ${modalFieldTone}`}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lead-sellerEmail" className="text-[var(--text)]">Seller email</Label>
                    <Input
                      id="lead-sellerEmail"
                      {...register("sellerEmail")}
                      type="email"
                      placeholder="seller@example.com"
                      className={`mt-2 h-11 rounded-[16px] ${modalFieldTone}`}
                    />
                  </div>

                  <div className={`${modalDepthInteractive} rounded-[20px] px-4 py-4`}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted-text)]">Lead posture</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {sellerSignals.map((signal) => (
                        <span
                          key={signal}
                          className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[11px] text-[var(--muted-text)]"
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <DialogFooter className={`sticky bottom-0 mt-auto flex items-center justify-between gap-4 border-t border-[color:rgba(148,163,184,0.12)] px-6 py-4 sm:px-7 ${modalDepthFooterSubtle}`}>
            <div className="min-w-0">
              <p className="text-sm text-[var(--text)]">The lead is only created when you submit.</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[var(--muted-text)]">
                  {watch("vin").trim() ? "VIN set" : "VIN missing"}
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[var(--muted-text)]">
                  {SOURCE_OPTIONS.find((option) => option.value === watch("sourceType"))?.label ?? "Auction"} source
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[var(--muted-text)]">
                  {sellerName.trim() ? "Seller named" : "Seller unnamed"}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
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
                {submitting ? "Creating…" : "Create lead"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
