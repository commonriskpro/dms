"use client";

import { useState } from "react";
import Link from "next/link";
import { DMSCard, DMSCardHeader, DMSCardTitle, DMSCardContent } from "@/components/ui/dms-card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { SessionsBlock } from "./SessionsBlock";

export type SectionId =
  | "profile"
  | "dealership"
  | "users-roles"
  | "notifications"
  | "security"
  | "integrations"
  | "dashboard";

const SECTIONS: { id: SectionId; label: string; href?: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "dealership", label: "Dealership" },
  { id: "dashboard", label: "Dashboard" },
  { id: "users-roles", label: "Users & Roles", href: "/admin/users" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Security" },
  { id: "integrations", label: "Integrations" },
];

export function SettingsContent() {
  const [section, setSection] = useState<SectionId>("profile");
  const [profileName, setProfileName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [dealershipName, setDealershipName] = useState("");
  const [defaultPipeline, setDefaultPipeline] = useState("sales");
  const [newLead, setNewLead] = useState(true);
  const [appointmentReminders, setAppointmentReminders] = useState(true);
  const [dealStatusChanges, setDealStatusChanges] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("30m");

  const navLinkBase =
    "block w-full text-left rounded-[var(--radius-button)] px-3 py-2 text-sm font-medium transition-colors duration-150";
  const navLinkActive = "bg-[var(--muted)] text-[var(--text)]";
  const navLinkInactive =
    "text-[var(--muted-text)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]";

  return (
    <div className={`grid gap-[var(--space-grid)] lg:grid-cols-[280px_1fr]`}>
      <nav aria-label="Settings sections">
        <DMSCard className="p-2">
          {SECTIONS.map((s) =>
            s.href ? (
              <Link key={s.id} href={s.href} className={`${navLinkBase} ${navLinkInactive}`}>
                {s.label}
              </Link>
            ) : (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={`${navLinkBase} ${section === s.id ? navLinkActive : navLinkInactive}`}
              >
                {s.label}
              </button>
            )
          )}
        </DMSCard>
      </nav>

      <div className="min-w-0 space-y-4">
        {section === "profile" && (
          <DMSCard>
            <DMSCardHeader>
              <DMSCardTitle>Profile</DMSCardTitle>
            </DMSCardHeader>
            <DMSCardContent className="space-y-4">
              <Input
                label="Name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Your name"
              />
              <Input label="Email" value="" readOnly placeholder="you@example.com" />
              <Select
                label="Timezone"
                id="timezone"
                options={[
                  { value: "America/New_York", label: "Eastern (America/New_York)" },
                  { value: "America/Chicago", label: "Central (America/Chicago)" },
                  { value: "America/Denver", label: "Mountain (America/Denver)" },
                  { value: "America/Los_Angeles", label: "Pacific (America/Los_Angeles)" },
                ]}
                value={timezone}
                onChange={(v) => setTimezone(v)}
              />
              <Button disabled title="Coming soon">
                Save changes
              </Button>
            </DMSCardContent>
          </DMSCard>
        )}

        {section === "dealership" && (
          <DMSCard>
            <DMSCardHeader>
              <DMSCardTitle>Dealership</DMSCardTitle>
            </DMSCardHeader>
            <DMSCardContent className="space-y-4">
              <Input
                label="Dealership Name"
                value={dealershipName}
                onChange={(e) => setDealershipName(e.target.value)}
                placeholder="Dealership name"
              />
              <Select
                label="Default Pipeline"
                id="default-pipeline"
                options={[
                  { value: "sales", label: "Sales" },
                  { value: "service", label: "Service" },
                  { value: "parts", label: "Parts" },
                ]}
                value={defaultPipeline}
                onChange={(v) => setDefaultPipeline(v)}
              />
              <Input label="Currency" value="USD" readOnly />
              <Button variant="secondary" disabled title="Coming soon">
                Save dealership settings
              </Button>
            </DMSCardContent>
          </DMSCard>
        )}

        {section === "users-roles" && (
          <DMSCard>
            <DMSCardHeader>
              <DMSCardTitle>Users & Roles</DMSCardTitle>
            </DMSCardHeader>
            <DMSCardContent>
              <p className="text-sm text-[var(--muted-text)] mb-4">
                Manage users and role assignments in Admin.
              </p>
              <Link
                href="/admin/users"
                className="inline-flex items-center justify-center font-medium border px-4 py-2 text-sm rounded-md bg-[var(--muted)] text-[var(--text)] hover:bg-[var(--muted)]/80 border-[var(--border)] transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
              >
                Open Users & Roles
              </Link>
            </DMSCardContent>
          </DMSCard>
        )}

        {section === "notifications" && (
          <DMSCard>
            <DMSCardHeader>
              <DMSCardTitle>Notifications</DMSCardTitle>
            </DMSCardHeader>
            <DMSCardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">New lead</p>
                  <p className="text-xs text-[var(--muted-text)]">When a new lead is created</p>
                </div>
                <Switch checked={newLead} onCheckedChange={setNewLead} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">Appointment reminders</p>
                  <p className="text-xs text-[var(--muted-text)]">Before scheduled appointments</p>
                </div>
                <Switch checked={appointmentReminders} onCheckedChange={setAppointmentReminders} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">Deal status changes</p>
                  <p className="text-xs text-[var(--muted-text)]">When deal stage or status changes</p>
                </div>
                <Switch checked={dealStatusChanges} onCheckedChange={setDealStatusChanges} />
              </div>
              <Button variant="secondary" disabled title="Coming soon">
                Save notification settings
              </Button>
            </DMSCardContent>
          </DMSCard>
        )}

        {section === "security" && (
          <DMSCard>
            <DMSCardHeader>
              <DMSCardTitle>Security</DMSCardTitle>
            </DMSCardHeader>
            <DMSCardContent className="space-y-4">
              <div className="rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
                <p className="text-sm font-medium text-[var(--text)]">Two-factor authentication</p>
                <p className="text-xs text-[var(--muted-text)] mt-0.5">Coming soon</p>
              </div>
              <Separator />
              <Select
                label="Session timeout"
                id="session-timeout"
                options={[
                  { value: "15m", label: "15 minutes" },
                  { value: "30m", label: "30 minutes" },
                  { value: "1h", label: "1 hour" },
                  { value: "8h", label: "8 hours" },
                ]}
                value={sessionTimeout}
                onChange={(v) => setSessionTimeout(v)}
              />
              <Separator />
              <SessionsBlock />
            </DMSCardContent>
          </DMSCard>
        )}

        {section === "dashboard" && (
          <DMSCard>
            <DMSCardHeader>
              <DMSCardTitle>Dashboard</DMSCardTitle>
            </DMSCardHeader>
            <DMSCardContent className="space-y-3">
              <p className="text-sm text-[var(--muted-text)]">
                Customize which widgets appear on your dashboard and their order.
              </p>
              <Link
                href="/dashboard?customize=true"
                className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
              >
                Customize dashboard layout
              </Link>
            </DMSCardContent>
          </DMSCard>
        )}

        {section === "integrations" && (
          <DMSCard>
            <DMSCardHeader>
              <DMSCardTitle>Integrations</DMSCardTitle>
            </DMSCardHeader>
            <DMSCardContent className="space-y-3">
              {[
                { name: "Auction feed", connected: true },
                { name: "Accounting", connected: false },
                { name: "SMS", connected: true },
                { name: "Email", connected: false },
              ].map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3"
                >
                  <span className="text-sm font-medium text-[var(--text)]">{item.name}</span>
                  <Badge variant={item.connected ? "success" : "secondary"}>
                    {item.connected ? "Connected" : "Not connected"}
                  </Badge>
                </div>
              ))}
            </DMSCardContent>
          </DMSCard>
        )}
      </div>
    </div>
  );
}
