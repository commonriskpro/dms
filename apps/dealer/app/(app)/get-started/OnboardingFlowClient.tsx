"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  STEP_LABELS,
  TOTAL_STEPS,
  type OnboardingState,
} from "./onboarding-types";
import { DealershipInfoStep } from "./steps/DealershipInfoStep";
import { TeamSetupStep } from "./steps/TeamSetupStep";
import { InventorySetupStep } from "./steps/InventorySetupStep";
import { CrmBasicsStep } from "./steps/CrmBasicsStep";
import { OperationsBasicsStep } from "./steps/OperationsBasicsStep";
import { LaunchStep } from "./steps/LaunchStep";

export type OnboardingFlowClientProps = {
  /** Initial step from server (onboarding-status); flow will sync with GET /api/onboarding. */
  initialStep: number;
};

export function OnboardingFlowClient({ initialStep }: OnboardingFlowClientProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [state, setState] = React.useState<OnboardingState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState(false);

  const step = Math.max(1, Math.min(TOTAL_STEPS, state?.currentStep ?? initialStep));

  const fetchOnboarding = React.useCallback(async () => {
    try {
      const res = await apiFetch<{ onboarding: OnboardingState }>("/api/onboarding");
      setState(res.onboarding);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchOnboarding();
  }, [fetchOnboarding]);

  const patch = React.useCallback(
    async (body: Record<string, unknown>) => {
      setActionLoading(true);
      try {
        const res = await apiFetch<{ onboarding: OnboardingState }>("/api/onboarding", {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setState(res.onboarding);
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Failed to update");
        throw e;
      } finally {
        setActionLoading(false);
      }
    },
    [addToast]
  );

  const handleBack = React.useCallback(() => {
    if (step <= 1) return;
    patch({ currentStep: step - 1 });
  }, [step, patch]);

  const handleCompleteStep = React.useCallback(() => {
    patch({ completeStep: step });
  }, [step, patch]);

  const handleSkipStep = React.useCallback(() => {
    patch({ skipStep: step });
  }, [step, patch]);

  const handleAdvanceStep = React.useCallback(() => {
    if (step >= TOTAL_STEPS) return;
    patch({ currentStep: step + 1 });
  }, [step, patch]);

  const handleSetInventoryPath = React.useCallback(
    (path: "add_first" | "import" | "later") => {
      patch({ inventoryPathChosen: path });
    },
    [patch]
  );

  const handleMarkComplete = React.useCallback(async () => {
    await patch({ markComplete: true });
    addToast("success", "You're all set! Taking you to the dashboard.");
    router.replace("/dashboard");
    router.refresh();
  }, [patch, addToast, router]);

  const handleFinishLater = React.useCallback(() => {
    router.replace("/dashboard");
    router.refresh();
  }, [router]);

  if (loading) {
    return (
      <div className="max-w-xl">
        <p className="text-[var(--text-soft)]">Loading your setup…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl">
        <Card className="border-[var(--danger)]">
          <CardContent className="pt-4">
            <p className="text-[var(--danger-muted-fg)]">{error}</p>
            <Button variant="secondary" className="mt-3" onClick={() => { setError(""); fetchOnboarding(); }}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state?.isComplete) {
    router.replace("/dashboard");
    router.refresh();
    return (
      <div className="max-w-xl">
        <p className="text-[var(--text-soft)]">Redirecting to dashboard…</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Set up your dealership</h1>
        <p className="mt-1 text-sm text-[var(--text-soft)]">
          Step {step} of {TOTAL_STEPS} — {STEP_LABELS[step] ?? ""}
        </p>
        {/* Step rail: simple progress bar */}
        <div
          className="mt-3 h-1.5 w-full rounded-full bg-[var(--muted)] overflow-hidden"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
        >
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-200"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {step < TOTAL_STEPS && (
        <p className="text-sm text-[var(--text-soft)]">
          <button
            type="button"
            onClick={handleFinishLater}
            className="font-medium text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded"
          >
            Finish later
          </button>
          {" — go to dashboard now and resume setup anytime."}
        </p>
      )}

      <Card className="border-[var(--border)] bg-[var(--panel)] shadow-sm">
        <CardContent className="pt-4 pb-4">
          {step === 1 && (
            <DealershipInfoStep
              onBack={undefined}
              onNext={handleCompleteStep}
              onSkip={undefined}
              isLoading={actionLoading}
            />
          )}
          {step === 2 && (
            <TeamSetupStep
              onBack={handleBack}
              onNext={handleCompleteStep}
              onSkip={handleSkipStep}
              isLoading={actionLoading}
            />
          )}
          {step === 3 && (
            <InventorySetupStep
              onBack={handleBack}
              onNext={handleSetInventoryPath}
              onSkip={() => handleSetInventoryPath("later")}
              isLoading={actionLoading}
              currentPath={state?.inventoryPathChosen}
            />
          )}
          {step === 4 && (
            <CrmBasicsStep
              onBack={handleBack}
              onNext={handleCompleteStep}
              onSkip={handleSkipStep}
              isLoading={actionLoading}
            />
          )}
          {step === 5 && (
            <OperationsBasicsStep
              onBack={handleBack}
              onNext={handleCompleteStep}
              onSkip={handleSkipStep}
              isLoading={actionLoading}
            />
          )}
          {step === 6 && (
            <LaunchStep
              onBack={handleBack}
              onFinish={handleMarkComplete}
              onFinishLater={handleFinishLater}
              isLoading={actionLoading}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
