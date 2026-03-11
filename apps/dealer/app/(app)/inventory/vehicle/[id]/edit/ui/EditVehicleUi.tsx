"use client";

import * as React from "react";
import Link from "next/link";
import {
  DMSCard,
  DMSCardContent,
  DMSCardHeader,
  DMSCardTitle,
} from "@/components/ui/dms-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { Widget } from "@/components/ui-system/widgets/Widget";
import { Check, ChevronRight, FileText, Printer } from "@/lib/ui/icons";
import { useSession } from "@/contexts/session-context";
import { VehiclePhotosManager } from "@/modules/inventory/ui/components/VehiclePhotosManager";
import { CostsTabContent } from "@/modules/inventory/ui/components/CostsTabContent";
import { inventoryCostsPath, inventoryDetailPath } from "@/lib/routes/detail-paths";
import { cn } from "@/lib/utils";
import { typography } from "@/lib/ui/tokens";

const CARD_HEADER = "px-5 pt-4 pb-3";
const CARD_BODY = "px-5 pb-5 pt-0";

/**
 * Left rail media preview. Entire preview area opens the media manager when clicked.
 * Strong hover/focus affordance; optional "Manage media" overlay on hover.
 */
function LeftMediaCard({
  onOpenMedia,
  disabled,
}: {
  onOpenMedia?: () => void;
  disabled?: boolean;
}) {
  const isClickable = Boolean(onOpenMedia && !disabled);

  const content = (
    <div className="group/media relative space-y-3">
      <div
        className="relative aspect-[16/9] rounded-md border border-[var(--border)] bg-[var(--surface-2)]"
        aria-hidden
      >
        {isClickable && (
          <span className="absolute inset-0 flex items-center justify-center rounded-md bg-[var(--surface)]/80 text-xs font-medium text-[var(--text-soft)] opacity-0 transition group-hover/media:opacity-100 group-focus-visible/trigger:opacity-100">
            Manage media
          </span>
        )}
      </div>
      <div className="flex gap-2 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-14 w-20 shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface-2)]"
            aria-hidden
          />
        ))}
        <div
          className="flex h-14 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-soft)]"
          aria-hidden
        >
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
      <p className="text-xs text-[var(--text-soft)]">Tip: click to manage media</p>
    </div>
  );

  return (
    <DMSCard>
      <DMSCardContent className={`${CARD_BODY} pt-4`}>
        {isClickable ? (
          <button
            type="button"
            onClick={onOpenMedia}
            className="group/trigger w-full rounded-md border border-transparent text-left transition cursor-pointer hover:bg-[var(--surface-2)] hover:border-[var(--border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            aria-label="Open media manager"
          >
            {content}
          </button>
        ) : (
          content
        )}
      </DMSCardContent>
    </DMSCard>
  );
}

function QuickActionsCard({ vehicleId }: { vehicleId?: string }) {
  return (
    <DMSCard className="lg:sticky lg:top-6">
      <DMSCardHeader className={CARD_HEADER}>
        <DMSCardTitle className="text-base font-semibold text-[var(--text)]">
          Edit controls
        </DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={CARD_BODY}>
        <p className="mb-4 text-sm leading-6 text-[var(--text-soft)]">
          Use edit mode to refine specs, media, and ledger posture while keeping the vehicle operating record intact.
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="primary" className="w-full" disabled title="Edit form not yet connected">
            Save
          </Button>
          <Button variant="secondary" className="w-full" disabled title="Edit form not yet connected">
            Save & Close
          </Button>
          {vehicleId ? (
            <Link href={`/deals/new?vehicleId=${vehicleId}`}>
              <Button variant="outline" className="w-full justify-start gap-2">
                <FileText className="h-4 w-4" aria-hidden />
                Create Deal
              </Button>
            </Link>
          ) : (
            <Button variant="outline" className="w-full justify-start gap-2" disabled>
              <FileText className="h-4 w-4" aria-hidden />
              Create Deal
            </Button>
          )}
          <Button variant="outline" className="w-full justify-start gap-2" disabled title="Use Print from vehicle detail view">
            <Printer className="h-4 w-4" aria-hidden />
            Print
          </Button>
        </div>
      </DMSCardContent>
    </DMSCard>
  );
}

function PricingCard() {
  const rows = [
    { label: "Sale Price", value: "$29,900" },
    { label: "Auction Cost", value: "$25,000" },
    { label: "Transport Cost", value: "$500" },
    { label: "Recon Cost", value: "$1,200" },
    { label: "Total Costs", value: "$26,700" },
  ];
  return (
    <DMSCard>
      <DMSCardHeader className={CARD_HEADER}>
        <DMSCardTitle className="text-base font-semibold text-[var(--text)]">
          Pricing
        </DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={CARD_BODY}>
        <dl className="space-y-2">
          {rows.map(({ label, value }) => (
            <div
              key={label}
              className="flex justify-between gap-2 text-sm"
            >
              <dt className="text-[var(--text-soft)]">{label}</dt>
              <dd className="text-[var(--text)]">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 mt-3 flex justify-between items-center">
          <span className="text-sm font-medium text-[var(--text)]">
            + $3,200 profit
          </span>
          <span className="text-sm text-[var(--text-soft)]">11.9% margin</span>
        </div>
        <p className="text-[var(--text-soft)] text-xs mt-2">
          * Target &gt; 15% profit margin
        </p>
      </DMSCardContent>
    </DMSCard>
  );
}

function DetailsCard() {
  const rows = [
    { label: "Transmission", value: "Automatic" },
    { label: "Color", value: "Black" },
    { label: "Drivetrain", value: "4WD" },
    { label: "Engine", value: "5.3L V8" },
    { label: "Fuel", value: "Gasoline" },
  ];
  return (
    <DMSCard>
      <DMSCardHeader className={CARD_HEADER}>
        <DMSCardTitle className="text-base font-semibold text-[var(--text)]">
          Details
        </DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={CARD_BODY}>
        <dl className="space-y-2">
          {rows.map(({ label, value }) => (
            <div
              key={label}
              className="flex justify-between gap-2 text-sm"
            >
              <dt className="text-[var(--text-soft)]">{label}</dt>
              <dd className="text-[var(--text)]">{value}</dd>
            </div>
          ))}
        </dl>
      </DMSCardContent>
    </DMSCard>
  );
}

const RECON_ITEMS = [
  { label: "Inspection", done: true },
  { label: "Recall Check", done: true },
  { label: "Detail", done: true },
  { label: "Photos", done: true },
];

function ReconCard() {
  return (
    <DMSCard>
      <DMSCardHeader className={CARD_HEADER}>
        <DMSCardTitle className="text-base font-semibold text-[var(--text)]">
          Recon
        </DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={CARD_BODY}>
        <ul className="space-y-2" role="list">
          {RECON_ITEMS.map(({ label, done }) => (
            <li
              key={label}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="flex items-center gap-2 text-[var(--text)]">
                {done ? (
                  <Check className="h-4 w-4 text-[var(--success)]" aria-hidden />
                ) : null}
                {label}
              </span>
              <ChevronRight className="h-4 w-4 text-[var(--text-soft)] shrink-0" aria-hidden />
            </li>
          ))}
        </ul>
        <div
          className="rounded-md bg-[var(--success-muted)] px-3 py-2 mt-3 text-sm text-[var(--text)]"
          role="status"
        >
          Ready for sale
        </div>
      </DMSCardContent>
    </DMSCard>
  );
}

function FloorplanCard() {
  return (
    <DMSCard>
      <DMSCardHeader className={CARD_HEADER}>
        <DMSCardTitle className="text-base font-semibold text-[var(--text)]">
          Floorplan
        </DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={CARD_BODY}>
        <p className="text-sm text-[var(--text-soft)] mb-3">No floorplan</p>
        <Button variant="outline" size="sm" disabled title="Manage floorplan from vehicle detail view">
          Add floorplan
        </Button>
      </DMSCardContent>
    </DMSCard>
  );
}

const SPECS_ROWS = [
  { label: "Year", value: "2021" },
  { label: "Make", value: "CHEVROLET" },
  { label: "Model", value: "Tahoe" },
  { label: "Trim", value: "LTZ AWD" },
  { label: "Engine", value: "5.3L V8" },
  { label: "Fuel", value: "Gasoline" },
];

function SpecsVinCard() {
  return (
    <DMSCard className="flex flex-col">
      <DMSCardHeader className={CARD_HEADER}>
        <DMSCardTitle className="text-base font-semibold text-[var(--text)]">
          Specs / VIN
        </DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={`${CARD_BODY} flex flex-col flex-1`}>
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm font-mono text-[var(--text)] mb-4">
          1GNSKCC1MR124456
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm flex-1">
          {SPECS_ROWS.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-[var(--text-soft)]">{label}</dt>
              <dd className="text-[var(--text)] font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <Button variant="outline" size="sm" className="mt-4 w-full sm:w-auto" disabled title="VIN decode available from vehicle detail view">
          Auto-fill missing specs
        </Button>
      </DMSCardContent>
    </DMSCard>
  );
}

function PlaceholderTabContent({ title }: { title: string }) {
  return (
    <DMSCard>
      <DMSCardHeader className={CARD_HEADER}>
        <DMSCardTitle className="text-base font-semibold text-[var(--text)]">
          {title}
        </DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={CARD_BODY}>
        <p className="text-[var(--text-soft)] text-sm">Coming soon</p>
      </DMSCardContent>
    </DMSCard>
  );
}

const TAB_IDS = [
  "vehicle-info",
  "media",
  "market-data",
  "purchase-info",
  "activities",
  "files",
  "logs",
  "marketing",
] as const;

const TAB_LABELS: Record<(typeof TAB_IDS)[number], string> = {
  "vehicle-info": "Vehicle Info",
  media: "Media",
  "market-data": "Market Data",
  "purchase-info": "Cost Ledger",
  activities: "Activities",
  files: "Files",
  logs: "Logs",
  marketing: "Marketing",
};

export type EditVehicleUiProps = {
  /** When provided, vehicle-specific actions route to the canonical detail surface. */
  vehicleId?: string;
};

export default function EditVehicleUi({ vehicleId }: EditVehicleUiProps) {
  const [activeTab, setActiveTab] = React.useState<string>("vehicle-info");
  const [mediaManagerOpen, setMediaManagerOpen] = React.useState(false);
  const { hasPermission } = useSession();
  const canReadDocs = hasPermission("documents.read");
  const canWrite = hasPermission("inventory.write");
  const canWriteDocs = hasPermission("documents.write");

  const openMediaManager = React.useCallback(() => setMediaManagerOpen(true), []);

  /** Cost Ledger tab gets full width — hide the left media/quick-actions rail */
  const isCostsTab = activeTab === "purchase-info";
  const activeTabLabel = TAB_LABELS[activeTab as keyof typeof TAB_LABELS] ?? "Vehicle Info";
  const editSignals = [
    {
      label: "Active section",
      value: activeTabLabel,
      detail: "Current edit workspace in focus.",
    },
    {
      label: "Media mode",
      value: vehicleId ? "Live" : "Pending",
      detail: vehicleId ? "Media manager is available for this vehicle." : "Create the vehicle before media management is live.",
    },
    {
      label: "Ledger access",
      value: vehicleId ? "Open" : "Pending",
      detail: vehicleId ? "Cost ledger can open in-page or full page." : "Ledger actions unlock after the vehicle exists.",
    },
    {
      label: "Write posture",
      value: canWrite ? "Writable" : "Read only",
      detail: canWrite ? "Mutation controls are available for edit actions." : "This workspace is currently read-only.",
    },
  ];

  return (
    <PageShell
      fullWidth
      contentClassName="px-4 sm:px-6 lg:px-8 min-[1800px]:px-10 min-[2200px]:px-14"
      className="flex flex-col gap-4 min-[1800px]:gap-5"
    >
      <PageHeader
        title={
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
              Inventory edit board
            </p>
            <h1 className={cn(typography.pageTitle, "tracking-[-0.04em]")}>Vehicle edit workspace</h1>
            <p className="max-w-4xl text-sm leading-7 text-[var(--muted-text)]">
              Refine specs, media, and ledger posture without leaving the vehicle operating record.
            </p>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {vehicleId ? (
              <Link
                href={inventoryDetailPath(vehicleId)}
                className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)] hover:text-[var(--text)]"
              >
                Back to vehicle
              </Link>
            ) : null}
            <div className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
              {TAB_IDS.length} edit sections
            </div>
          </div>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2 min-[1500px]:grid-cols-4">
        {editSignals.map((signal, index) => (
          <section
            key={signal.label}
            className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] px-4 py-3 shadow-[var(--shadow-card)]"
          >
            <div
              className={cn(
                "absolute inset-x-0 bottom-0 h-px opacity-90",
                index === 0
                  ? "bg-[linear-gradient(90deg,rgba(56,189,248,0.0)_0%,rgba(56,189,248,0.85)_100%)]"
                  : index === 1
                    ? "bg-[linear-gradient(90deg,rgba(14,165,233,0.0)_0%,rgba(14,165,233,0.85)_100%)]"
                    : index === 2
                      ? "bg-[linear-gradient(90deg,rgba(34,197,94,0.0)_0%,rgba(34,197,94,0.85)_100%)]"
                      : "bg-[linear-gradient(90deg,rgba(245,158,11,0.0)_0%,rgba(245,158,11,0.88)_100%)]"
              )}
            />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{signal.label}</p>
            <div className="mt-2 text-[28px] font-bold leading-none tracking-[-0.03em] text-[var(--text)]">
              {signal.value}
            </div>
            <p className="mt-2 text-sm text-[var(--muted-text)]">{signal.detail}</p>
          </section>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.65fr_0.95fr] min-[1800px]:grid-cols-[1.8fr_0.9fr]">
        <Widget
          title="Vehicle edit workbench"
          subtitle="Keep the section strip, live editor, and media-ledger pivots in one operating surface."
        >
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            aria-label="Edit vehicle sections"
          >
            <TabsList className="mb-0 w-full justify-start rounded-none">
              {TAB_IDS.map((id) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  selected={activeTab === id}
                  onSelect={() => setActiveTab(id)}
                >
                  {TAB_LABELS[id]}
                </TabsTrigger>
              ))}
              <span
                className="ml-1 border-b-2 border-transparent px-3 py-2 text-[var(--text-soft)] -mb-px"
                aria-hidden
              >
                …
              </span>
            </TabsList>

            <div className="pt-5">
              <div className={isCostsTab ? "" : "grid gap-6 lg:grid-cols-[340px_1fr]"}>
                {!isCostsTab && (
                  <div className="space-y-6">
                    <LeftMediaCard
                      onOpenMedia={vehicleId ? openMediaManager : undefined}
                      disabled={!vehicleId}
                    />
                    <QuickActionsCard vehicleId={vehicleId} />
                  </div>
                )}

                <div>
                  <TabsContent
                    value="vehicle-info"
                    selected={activeTab === "vehicle-info"}
                  >
                    <div className="grid gap-6 lg:grid-cols-3">
                      <div className="space-y-6 lg:col-span-1">
                        <PricingCard />
                        <DetailsCard />
                      </div>
                      <div className="space-y-6 lg:col-span-1">
                        <ReconCard />
                        <FloorplanCard />
                      </div>
                      <div className="lg:col-span-1">
                        <SpecsVinCard />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="media" selected={activeTab === "media"}>
                    {vehicleId ? (
                      <VehiclePhotosManager
                        vehicleId={vehicleId}
                        canReadDocs={canReadDocs}
                        canWrite={canWrite}
                        canWriteDocs={canWriteDocs}
                      />
                    ) : (
                      <PlaceholderTabContent title={TAB_LABELS.media} />
                    )}
                  </TabsContent>

                  <TabsContent value="purchase-info" selected={activeTab === "purchase-info"}>
                    {vehicleId ? (
                      <div className="space-y-3">
                        <div className="flex justify-end">
                          <Link
                            href={inventoryCostsPath(vehicleId)}
                            className="text-xs font-medium text-[var(--accent)] hover:underline"
                          >
                            Open full page
                          </Link>
                        </div>
                        <CostsTabContent vehicleId={vehicleId} mode="embedded" />
                      </div>
                    ) : (
                      <PlaceholderTabContent title={TAB_LABELS["purchase-info"]} />
                    )}
                  </TabsContent>

                  {TAB_IDS.filter((id) => id !== "vehicle-info" && id !== "media" && id !== "purchase-info").map((id) => (
                    <TabsContent
                      key={id}
                      value={id}
                      selected={activeTab === id}
                    >
                      <PlaceholderTabContent title={TAB_LABELS[id]} />
                    </TabsContent>
                  ))}
                </div>
              </div>
            </div>
          </Tabs>
        </Widget>

        <aside className="space-y-4">
          <Widget
            title="Edit guidance"
            subtitle="Use the current section and vehicle state to decide the next edit move."
            className="h-fit"
          >
            <div className="space-y-3 text-sm leading-6 text-[var(--muted-text)]">
              <p>
                Active focus: <span className="font-semibold text-[var(--text)]">{activeTabLabel}</span>
              </p>
              <p>
                {activeTab === "media"
                  ? "Use media mode to fix merchandising before repricing or publishing."
                  : activeTab === "purchase-info"
                    ? "Use the ledger view to clean acquisition and recon posture before retail decisions."
                    : "Use the main edit sections to tighten identity, specs, and readiness before moving back to the operating record."}
              </p>
            </div>
          </Widget>
        </aside>
      </div>

      {/* Modal: existing media manager (VehiclePhotosManager) opened when user clicks left preview (Shopify-style) */}
      <Dialog
        open={mediaManagerOpen}
        onOpenChange={setMediaManagerOpen}
        contentClassName="relative z-50 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-lg py-6 flex flex-col"
      >
        <DialogContent>
          <DialogHeader className="shrink-0 pb-4">
            <DialogTitle className="text-[var(--text)]">Manage media</DialogTitle>
          </DialogHeader>
          <div className="flex flex-1 min-h-0 overflow-auto justify-center px-1">
            {vehicleId && (
              <VehiclePhotosManager
                vehicleId={vehicleId}
                canReadDocs={canReadDocs}
                canWrite={canWrite}
                canWriteDocs={canWriteDocs}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
