"use client";

import * as React from "react";
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
import { Check, ChevronRight, FileText, Printer } from "lucide-react";
import { useSession } from "@/contexts/session-context";
import { VehiclePhotosManager } from "@/modules/inventory/ui/components/VehiclePhotosManager";

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

const MOCK_QUICK = {
  stockNumber: "4521",
  vin: "1GNSKCC1MR123456",
  year: "2021",
  make: "CHEVROLET",
  trim: "LTZ AWD",
  mileage: "54,021 mi",
};

function QuickActionsCard() {
  const rows = [
    { label: "Stock #", value: MOCK_QUICK.stockNumber },
    { label: "VIN", value: MOCK_QUICK.vin },
    { label: "Year", value: MOCK_QUICK.year },
    { label: "Make", value: MOCK_QUICK.make },
    { label: "Trim", value: MOCK_QUICK.trim },
    { label: "Mileage", value: MOCK_QUICK.mileage },
  ];
  return (
    <DMSCard className="lg:sticky lg:top-6">
      <DMSCardHeader className={CARD_HEADER}>
        <DMSCardTitle className="text-base font-semibold text-[var(--text)]">
          Quick Actions
        </DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={CARD_BODY}>
        <dl className="space-y-2 mb-4">
          {rows.map(({ label, value }) => (
            <div
              key={label}
              className="flex justify-between gap-2 text-sm"
            >
              <dt className="text-[var(--text-soft)]">{label}</dt>
              <dd className="text-[var(--text)] font-medium truncate">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-2">
          <Button variant="primary" className="w-full">
            Save
          </Button>
          <Button variant="secondary" className="w-full">
            Save & Close
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2">
            <FileText className="h-4 w-4" aria-hidden />
            Create Deal
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2">
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
        <Button variant="outline" size="sm">
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
        <Button variant="outline" size="sm" className="mt-4 w-full sm:w-auto">
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
  "marketing",
  "media",
  "market-data",
  "purchase-info",
  "activities",
  "files",
  "logs",
] as const;

const TAB_LABELS: Record<(typeof TAB_IDS)[number], string> = {
  "vehicle-info": "Vehicle Info",
  marketing: "Marketing",
  media: "Media",
  "market-data": "Market Data",
  "purchase-info": "Purchase Info",
  activities: "Activities",
  files: "Files",
  logs: "Logs",
};

export type EditVehicleUiProps = {
  /** When provided, breadcrumb and close link go to /inventory/[vehicleId]; otherwise /inventory. */
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

  return (
    <div className="space-y-6">
      {/* Title row */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-[var(--text)]">
          2021 Chevrolet Tahoe LTZ
        </h1>
        <Button
          variant="secondary"
          size="sm"
          className="rounded-full border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]"
        >
          Edit
        </Button>
      </div>

      {/* Single Tabs row */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        aria-label="Edit vehicle sections"
      >
        <TabsList className="w-full justify-start rounded-none mb-0">
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
          <button
            type="button"
            className="px-3 py-2 text-[var(--text-soft)] hover:text-[var(--text)] border-b-2 border-transparent -mb-px ml-1"
            aria-label="More tabs"
          >
            …
          </button>
        </TabsList>

        {/* Content area: outer panel + two-column grid */}
        <div className="rounded-xl bg-[var(--panel)] p-6">
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            {/* Left rail: media preview opens existing media manager (VehiclePhotosManager) on click */}
            <div className="space-y-6">
              <LeftMediaCard
                onOpenMedia={vehicleId ? openMediaManager : undefined}
                disabled={!vehicleId}
              />
              <QuickActionsCard />
            </div>

            {/* Main workspace */}
            <div>
              <TabsContent
                value="vehicle-info"
                selected={activeTab === "vehicle-info"}
              >
                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-1 space-y-6">
                    <PricingCard />
                    <DetailsCard />
                  </div>
                  <div className="lg:col-span-1 space-y-6">
                    <ReconCard />
                    <FloorplanCard />
                  </div>
                  <div className="lg:col-span-1">
                    <SpecsVinCard />
                  </div>
                </div>
              </TabsContent>

              {/* Media tab: same VehiclePhotosManager as modal (existing media manager entry point) */}
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

              {TAB_IDS.filter((id) => id !== "vehicle-info" && id !== "media").map((id) => (
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

      {/* Modal: existing media manager (VehiclePhotosManager) opened when user clicks left preview (Shopify-style) */}
      <Dialog open={mediaManagerOpen} onOpenChange={setMediaManagerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[var(--text)]">Manage media</DialogTitle>
          </DialogHeader>
          {vehicleId && (
            <VehiclePhotosManager
              vehicleId={vehicleId}
              canReadDocs={canReadDocs}
              canWrite={canWrite}
              canWriteDocs={canWriteDocs}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
