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
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { RuleRow } from "./PricingRulesManager";

const schema = z.object({
  name: z.string().min(1, "Name required").max(256),
  ruleType: z.enum(["AGE_BASED", "MARKET_BASED", "CLEARANCE"]),
  daysInStock: z.coerce.number().int().min(0).optional().nullable(),
  adjustmentPercent: z.number().optional().nullable(),
  adjustmentCents: z.number().int().optional().nullable(),
  enabled: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const RULE_TYPE_OPTIONS: SelectOption[] = [
  { value: "AGE_BASED", label: "Age based" },
  { value: "MARKET_BASED", label: "Market based" },
  { value: "CLEARANCE", label: "Clearance" },
];

export type PricingRuleFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  ruleId?: string;
  initialRule?: RuleRow | null;
};

export function PricingRuleForm({
  open,
  onOpenChange,
  onSuccess,
  ruleId,
  initialRule,
}: PricingRuleFormProps) {
  const { addToast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);
  const isEdit = Boolean(ruleId && initialRule);

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
      name: "",
      ruleType: "AGE_BASED",
      daysInStock: undefined,
      adjustmentPercent: undefined,
      adjustmentCents: undefined,
      enabled: true,
    },
  });

  React.useEffect(() => {
    if (open && initialRule) {
      setValue("name", initialRule.name);
      setValue("ruleType", initialRule.ruleType as FormValues["ruleType"]);
      setValue("daysInStock", initialRule.daysInStock ?? undefined);
      setValue("adjustmentPercent", initialRule.adjustmentPercent ?? undefined);
      setValue("adjustmentCents", initialRule.adjustmentCents ?? undefined);
      setValue("enabled", initialRule.enabled);
    }
    if (!open) reset();
  }, [open, initialRule, setValue, reset]);

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      if (isEdit && ruleId) {
        await apiFetch(`/api/inventory/pricing-rules/${ruleId}`, {
          method: "PATCH",
          body: JSON.stringify({
            daysInStock: data.daysInStock ?? undefined,
            adjustmentPercent: data.adjustmentPercent ?? undefined,
            adjustmentCents: data.adjustmentCents ?? undefined,
            enabled: data.enabled,
          }),
        });
        addToast("success", "Rule updated");
      } else {
        await apiFetch("/api/inventory/pricing-rules", {
          method: "POST",
          body: JSON.stringify({
            name: data.name,
            ruleType: data.ruleType,
            daysInStock: data.daysInStock ?? undefined,
            adjustmentPercent: data.adjustmentPercent ?? undefined,
            adjustmentCents: data.adjustmentCents ?? undefined,
            enabled: data.enabled,
          }),
        });
        addToast("success", "Rule created");
      }
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
        <DialogTitle className="text-[var(--text)]">
          {isEdit ? "Edit pricing rule" : "Create pricing rule"}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="rule-name" className="text-[var(--text)]">Name</Label>
          <Input
            id="rule-name"
            {...register("name")}
            disabled={isEdit}
            className="mt-1 border-[var(--border)] bg-[var(--surface)]"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-[var(--danger)]">{errors.name.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="rule-type" className="text-[var(--text)]">Rule type</Label>
          <Select
            id="rule-type"
            value={watch("ruleType")}
            onChange={(v) => setValue("ruleType", v as FormValues["ruleType"])}
            options={RULE_TYPE_OPTIONS}
            disabled={isEdit}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="rule-daysInStock" className="text-[var(--text)]">Days in stock (optional)</Label>
          <Input
            id="rule-daysInStock"
            type="number"
            min={0}
            {...register("daysInStock", { valueAsNumber: true })}
            className="mt-1 border-[var(--border)] bg-[var(--surface)]"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="rule-adjustmentPercent" className="text-[var(--text)]">Adjustment % (optional)</Label>
            <Input
              id="rule-adjustmentPercent"
              type="number"
              step={0.1}
              {...register("adjustmentPercent", { valueAsNumber: true })}
              className="mt-1 border-[var(--border)] bg-[var(--surface)]"
            />
          </div>
          <div>
            <Label htmlFor="rule-adjustmentCents" className="text-[var(--text)]">Adjustment ¢ (optional)</Label>
            <Input
              id="rule-adjustmentCents"
              type="number"
              {...register("adjustmentCents", { valueAsNumber: true })}
              className="mt-1 border-[var(--border)] bg-[var(--surface)]"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="rule-enabled"
            checked={watch("enabled")}
            onCheckedChange={(v) => setValue("enabled", v)}
          />
          <Label htmlFor="rule-enabled" className="text-[var(--text)]">Enabled</Label>
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
            className="bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
          >
            {submitting ? "Saving…" : isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
