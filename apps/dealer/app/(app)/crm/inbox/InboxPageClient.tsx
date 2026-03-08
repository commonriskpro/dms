"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { SignalContextBlock, type SignalSurfaceItem } from "@/components/ui-system";
import { typography } from "@/lib/ui/tokens";
import {
  fetchSignalsByDomains,
  toContextSignals,
} from "@/modules/intelligence/ui/surface-adapters";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
const CONVERSATIONS_PAGE_SIZE = 25;

type ConversationItem = {
  customerId: string;
  customerName: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  channel: "sms" | "email";
  direction: "inbound" | "outbound";
};

type ConversationsResponse = {
  data: ConversationItem[];
  meta: { total: number; limit: number; offset: number };
};

type TimelineEvent = {
  type: string;
  createdAt: string;
  createdByUserId: string | null;
  payloadJson: Record<string, unknown>;
  sourceId: string;
};

type TimelineResponse = {
  data: TimelineEvent[];
  meta: { total: number; limit: number; offset: number };
};

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatEventPreview(event: TimelineEvent): string {
  if (event.type !== "SYSTEM") return "";
  const ch = event.payloadJson?.channel as string | undefined;
  const dir = (event.payloadJson?.direction as string) ?? "outbound";
  const preview = (event.payloadJson?.contentPreview as string) ?? "";
  if (ch === "sms") return preview ? `SMS (${dir}): ${preview}` : `SMS (${dir})`;
  if (ch === "email") return preview ? `Email (${dir}): ${preview}` : `Email (${dir})`;
  return (event.payloadJson?.activityType as string) ?? "";
}

export function InboxPageClient({
  initialCustomerId,
}: {
  initialCustomerId: string | null;
}) {
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [conversations, setConversations] = React.useState<ConversationItem[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: CONVERSATIONS_PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string | null>(
    initialCustomerId
  );
  const [timeline, setTimeline] = React.useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = React.useState(false);
  const [smsOpen, setSmsOpen] = React.useState(false);
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [smsMessage, setSmsMessage] = React.useState("");
  const [emailSubject, setEmailSubject] = React.useState("");
  const [emailBody, setEmailBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [primaryPhone, setPrimaryPhone] = React.useState("");
  const [primaryEmail, setPrimaryEmail] = React.useState("");
  const [inboxSignals, setInboxSignals] = React.useState<SignalSurfaceItem[]>([]);

  const fetchConversations = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<ConversationsResponse>(
        `/api/crm/inbox/conversations?limit=${CONVERSATIONS_PAGE_SIZE}&offset=0`
      );
      setConversations(res.data);
      setMeta(res.meta);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  React.useEffect(() => {
    const id = searchParams.get("customerId") ?? selectedCustomerId;
    if (id) setSelectedCustomerId(id);
  }, [searchParams, selectedCustomerId]);

  const fetchTimeline = React.useCallback(async (customerId: string) => {
    setTimelineLoading(true);
    try {
      const res = await apiFetch<TimelineResponse>(
        `/api/customers/${customerId}/timeline?limit=50&offset=0`
      );
      const messageEvents = res.data.filter(
        (e) =>
          e.type === "SYSTEM" &&
          (e.payloadJson?.channel === "sms" || e.payloadJson?.channel === "email")
      );
      setTimeline(messageEvents);
    } catch {
      setTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (selectedCustomerId) fetchTimeline(selectedCustomerId);
    else setTimeline([]);
  }, [selectedCustomerId, fetchTimeline]);

  React.useEffect(() => {
    if (!selectedCustomerId) {
      setInboxSignals([]);
      return;
    }
    let mounted = true;
    fetchSignalsByDomains(["crm"], { limit: 30 })
      .then((signals) => {
        if (!mounted) return;
        setInboxSignals(signals);
      })
      .catch(() => {
        if (!mounted) return;
        setInboxSignals([]);
      });
    return () => {
      mounted = false;
    };
  }, [selectedCustomerId]);

  const customerContextSignals = React.useMemo(
    () =>
      toContextSignals(inboxSignals, {
        maxVisible: 5,
        entity: { entityType: "Customer", entityId: selectedCustomerId ?? undefined },
      }),
    [inboxSignals, selectedCustomerId]
  );

  const selectedConversation = conversations.find((c) => c.customerId === selectedCustomerId);
  const selectedName = selectedConversation?.customerName ?? "Customer";

  const sendSms = async () => {
    if (!selectedCustomerId || !primaryPhone.trim() || !smsMessage.trim()) return;
    setSending(true);
    try {
      await apiFetch("/api/messages/sms", {
        method: "POST",
        body: JSON.stringify({
          customerId: selectedCustomerId,
          phone: primaryPhone.trim(),
          message: smsMessage.trim(),
        }),
      });
      setSmsMessage("");
      setSmsOpen(false);
      addToast("success", "SMS sent");
      fetchTimeline(selectedCustomerId);
      fetchConversations();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const sendEmail = async () => {
    if (!selectedCustomerId || !primaryEmail.trim() || !emailSubject.trim() || !emailBody.trim())
      return;
    setSending(true);
    try {
      await apiFetch("/api/messages/email", {
        method: "POST",
        body: JSON.stringify({
          customerId: selectedCustomerId,
          email: primaryEmail.trim(),
          subject: emailSubject.trim(),
          body: emailBody.trim(),
        }),
      });
      setEmailSubject("");
      setEmailBody("");
      setEmailOpen(false);
      addToast("success", "Email sent");
      fetchTimeline(selectedCustomerId);
      fetchConversations();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const openSmsDialog = () => {
    if (selectedCustomerId) {
      apiFetch<{ data: { phones: { value: string; isPrimary: boolean }[] } }>(
        `/api/customers/${selectedCustomerId}`
      )
        .then((r) => {
          const phone =
            r.data.phones?.find((p) => p.isPrimary)?.value ?? r.data.phones?.[0]?.value ?? "";
          setPrimaryPhone(phone);
          setSmsOpen(true);
        })
        .catch(() => addToast("error", "Could not load customer"));
    }
  };

  const openEmailDialog = () => {
    if (selectedCustomerId) {
      apiFetch<{ data: { emails: { value: string; isPrimary: boolean }[] } }>(
        `/api/customers/${selectedCustomerId}`
      )
        .then((r) => {
          const email =
            r.data.emails?.find((e) => e.isPrimary)?.value ?? r.data.emails?.[0]?.value ?? "";
          setPrimaryEmail(email);
          setEmailOpen(true);
        })
        .catch(() => addToast("error", "Could not load customer"));
    }
  };

  return (
    <PageShell>
      <PageHeader
        title={<h1 className={typography.pageTitle}>Inbox</h1>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-12rem)] min-h-[400px]">
        <aside className="border border-[var(--border)] rounded-lg bg-[var(--surface)] overflow-hidden flex flex-col">
          <div className="p-2 border-b border-[var(--border)] font-medium text-sm text-[var(--text)]">
            Conversations
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded" />
              ))}
            </div>
          ) : error ? (
            <div className="p-4">
              <ErrorState message={error} onRetry={fetchConversations} />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 flex-1">
              <EmptyState
                title="No conversations"
                description="SMS and email messages with customers will appear here."
              />
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto divide-y divide-[var(--border)]" role="list">
              {conversations.map((c) => (
                <li key={c.customerId}>
                  <Link
                    href={`/crm/inbox?customerId=${encodeURIComponent(c.customerId)}`}
                    className={`block p-3 hover:bg-[var(--sidebar-hover)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                      selectedCustomerId === c.customerId
                        ? "bg-[var(--sidebar-active)] border-l-2 border-[var(--accent)]"
                        : ""
                    }`}
                    onClick={() => setSelectedCustomerId(c.customerId)}
                  >
                    <div className="font-medium text-[var(--text)] truncate">{c.customerName}</div>
                    <div className="text-xs text-[var(--text-soft)] truncate mt-0.5">
                      {c.lastMessagePreview || `${c.channel} (${c.direction})`}
                    </div>
                    <div className="text-xs text-[var(--text-soft)] mt-0.5">
                      {formatMessageTime(c.lastMessageAt)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="lg:col-span-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] flex flex-col overflow-hidden">
          {!selectedCustomerId ? (
            <div className="flex-1 flex items-center justify-center text-[var(--text-soft)]">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <h2 className="font-medium text-[var(--text)]">{selectedName}</h2>
                  <Link
                    href={`/customers/${selectedCustomerId}`}
                    className="text-sm text-[var(--accent)] hover:underline"
                  >
                    View customer
                  </Link>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={openSmsDialog} aria-label="Send SMS">
                    Send SMS
                  </Button>
                  <Button size="sm" variant="secondary" onClick={openEmailDialog} aria-label="Send email">
                    Send email
                  </Button>
                </div>
              </div>
              {customerContextSignals.length > 0 ? (
                <div className="px-3 pb-2 border-b border-[var(--border)]">
                  <SignalContextBlock
                    title="Customer alerts"
                    items={customerContextSignals}
                    maxVisible={3}
                  />
                </div>
              ) : null}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {timelineLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-3/4 ml-auto" />
                    <Skeleton className="h-12 w-2/3" />
                  </div>
                ) : timeline.length === 0 ? (
                  <EmptyState
                    title="No messages"
                    description="Send an SMS or email to start the conversation."
                  />
                ) : (
                  timeline.map((event) => (
                    <div
                      key={event.sourceId}
                      className={`rounded-lg px-3 py-2 max-w-[85%] ${
                        event.payloadJson?.direction === "inbound"
                          ? "bg-[var(--muted)] text-[var(--text)]"
                          : "bg-[var(--accent)]/15 text-[var(--text)] ml-auto"
                      }`}
                    >
                      <div className="text-xs text-[var(--text-soft)] mb-0.5">
                        {formatMessageTime(event.createdAt)} ·{" "}
                        {(event.payloadJson?.channel as string) === "email" ? "Email" : "SMS"} (
                        {(event.payloadJson?.direction as string) ?? "outbound"})
                      </div>
                      <div className="text-sm">
                        {formatEventPreview(event) || "—"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </main>
      </div>

      <Dialog open={smsOpen} onOpenChange={setSmsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send SMS</DialogTitle>
            <DialogDescription>Message will be sent via Twilio and logged to the timeline.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
          <label className="text-sm font-medium text-[var(--text)]">To</label>
          <Input value={primaryPhone} readOnly className="mt-1 bg-[var(--muted)]" />
          <label className="text-sm font-medium text-[var(--text)] mt-2 block">Message</label>
          <Input
            value={smsMessage}
            onChange={(e) => setSmsMessage(e.target.value)}
            placeholder="Type your message..."
            className="mt-1"
            maxLength={1600}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setSmsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={sendSms} disabled={sending || !smsMessage.trim()}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
          <DialogTitle>Send email</DialogTitle>
          <DialogDescription>Email will be sent via SendGrid and logged to the timeline.</DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-2">
          <div>
            <label className="text-sm font-medium text-[var(--text)]">To</label>
            <Input value={primaryEmail} readOnly className="mt-1 bg-[var(--muted)]" />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--text)]">Subject</label>
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Subject"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--text)]">Body</label>
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Message..."
              className="mt-1 w-full min-h-[120px] rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
              rows={5}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setEmailOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={sendEmail}
            disabled={sending || !emailSubject.trim() || !emailBody.trim()}
          >
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
