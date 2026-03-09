"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import type { CustomerDetail } from "@/lib/types/customers";

export type NextActionsCardProps = {
  customer: CustomerDetail;
  customerId: string;
  canRead: boolean;
  canWrite: boolean;
  onOpenSms?: () => void;
  onOpenEmail?: () => void;
  onOpenAppointment?: () => void;
  onOpenAddTask?: () => void;
  onOpenDisposition?: () => void;
};

const linkButtonClass =
  "inline-flex items-center justify-center font-medium border border-transparent px-2.5 py-1.5 text-sm rounded bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2";

export function NextActionsCard({
  customer,
  customerId,
  canRead,
  canWrite,
  onOpenSms,
  onOpenEmail,
  onOpenAppointment,
  onOpenAddTask,
  onOpenDisposition,
}: NextActionsCardProps) {
  const primaryPhone = customer.phones?.find((p) => p.isPrimary) ?? customer.phones?.[0];
  const primaryEmail = customer.emails?.find((e) => e.isPrimary) ?? customer.emails?.[0];

  return (
    <DMSCard>
      <DMSCardHeader>
        <DMSCardTitle>Next actions</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className="flex flex-wrap gap-2">
        {canRead ? (
          <Link
            href={`/crm/inbox?customerId=${encodeURIComponent(customerId)}`}
            className={linkButtonClass}
            aria-label="Open conversation"
          >
            Open Conversation
          </Link>
        ) : null}
        {canRead && primaryPhone ? (
          <a href={`tel:${primaryPhone.value.replace(/\D/g, "")}`} className={linkButtonClass} aria-label="Call">
            Call
          </a>
        ) : null}
        {canWrite && onOpenSms ? (
          <Button size="sm" onClick={onOpenSms} aria-label="Send SMS">
            Text
          </Button>
        ) : null}
        {canWrite && onOpenEmail ? (
          <Button size="sm" onClick={onOpenEmail} aria-label="Send email">
            Send email
          </Button>
        ) : null}
        {canRead && primaryEmail ? (
          <a href={`mailto:${primaryEmail.value}`} className={linkButtonClass} aria-label="Open email client">
            Email
          </a>
        ) : null}
        {canWrite && onOpenAppointment ? (
          <Button size="sm" variant="secondary" onClick={onOpenAppointment} aria-label="Schedule appointment">
            Schedule
          </Button>
        ) : null}
        {canWrite && onOpenAddTask ? (
          <Button size="sm" variant="secondary" onClick={onOpenAddTask} aria-label="Add task">
            Add task
          </Button>
        ) : null}
        {canWrite && onOpenDisposition ? (
          <Button size="sm" variant="secondary" onClick={onOpenDisposition} aria-label="Disposition">
            Disposition
          </Button>
        ) : null}
      </DMSCardContent>
    </DMSCard>
  );
}
