"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch, getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { useSession } from "@/contexts/session-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { SignalContextBlock, type SignalSurfaceItem } from "@/components/ui-system";
import { Widget } from "@/components/ui-system/widgets/Widget";
import { KpiCard } from "@/components/ui-system/widgets";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CustomerDetail } from "@/lib/types/customers";
import type { Opportunity } from "@/modules/crm-pipeline-automation/ui/types";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  fetchSignalsByDomains,
  toContextSignals,
} from "@/modules/intelligence/ui/surface-adapters";
import { customerDetailPath } from "@/lib/routes/detail-paths";

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
  meta: { total: number; limit: number; offset: number; hasMore: boolean; totalIsExact: boolean };
};

type InboxThreadMessage = {
  id: string;
  conversationId: string;
  customerId: string | null;
  channel: "sms" | "email";
  direction: "inbound" | "outbound";
  textBody: string | null;
  bodyPreview: string | null;
  createdAt: string;
};

type InboxThreadResponse = {
  data: InboxThreadMessage[];
  meta: { total: number; limit: number; offset: number };
};

type QueueState =
  | { label: "Unread inbound"; variant: "warning" }
  | { label: "Overdue reply"; variant: "danger" }
  | { label: "Waiting on customer"; variant: "info" }
  | { label: "Waiting on team"; variant: "neutral" };

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatEventPreview(message: InboxThreadMessage): string {
  return message.textBody ?? message.bodyPreview ?? `${message.channel.toUpperCase()} ${message.direction}`;
}

function conversationQueueState(conversation: ConversationItem | undefined): QueueState {
  if (!conversation) return { label: "Waiting on team", variant: "neutral" };
  const ageHours = (Date.now() - new Date(conversation.lastMessageAt).getTime()) / 3_600_000;
  if (conversation.direction === "inbound") {
    return ageHours >= 4
      ? { label: "Overdue reply", variant: "danger" }
      : { label: "Unread inbound", variant: "warning" };
  }
  return ageHours >= 48
    ? { label: "Waiting on customer", variant: "info" }
    : { label: "Waiting on team", variant: "neutral" };
}

export function InboxPageClient({
  initialCustomerId,
}: {
  initialCustomerId: string | null;
}) {
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const { hasPermission } = useSession();
  const canRead = hasPermission("crm.read");
  const canWrite = hasPermission("customers.write");

  const [conversations, setConversations] = React.useState<ConversationItem[]>([]);
  const [meta, setMeta] = React.useState({
    total: 0,
    limit: CONVERSATIONS_PAGE_SIZE,
    offset: 0,
    hasMore: false,
    totalIsExact: true,
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string | null>(initialCustomerId);
  const [selectedCustomer, setSelectedCustomer] = React.useState<CustomerDetail | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = React.useState<Opportunity | null>(null);
  const [contextLoading, setContextLoading] = React.useState(false);
  const [messages, setMessages] = React.useState<InboxThreadMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = React.useState(false);
  const [smsOpen, setSmsOpen] = React.useState(false);
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [taskOpen, setTaskOpen] = React.useState(false);
  const [callbackOpen, setCallbackOpen] = React.useState(false);
  const [callOpen, setCallOpen] = React.useState(false);
  const [smsMessage, setSmsMessage] = React.useState("");
  const [emailSubject, setEmailSubject] = React.useState("");
  const [emailBody, setEmailBody] = React.useState("");
  const [taskTitle, setTaskTitle] = React.useState("");
  const [taskDueAt, setTaskDueAt] = React.useState("");
  const [callbackAt, setCallbackAt] = React.useState("");
  const [callbackReason, setCallbackReason] = React.useState("");
  const [callSummary, setCallSummary] = React.useState("");
  const [callDurationSeconds, setCallDurationSeconds] = React.useState("300");
  const [actionLoading, setActionLoading] = React.useState(false);
  const [inboxSignals, setInboxSignals] = React.useState<SignalSurfaceItem[]>([]);
  const [queueReturnNotice, setQueueReturnNotice] = React.useState<string | null>(null);

  const selectedConversation = conversations.find((conversation) => conversation.customerId === selectedCustomerId);
  const queueState = conversationQueueState(selectedConversation);
  const selectedName = selectedCustomer?.name ?? selectedConversation?.customerName ?? "Customer";
  const returnTo = searchParams.get("returnTo");
  const primaryPhone =
    selectedCustomer?.phones?.find((phone) => phone.isPrimary)?.value ??
    selectedCustomer?.phones?.[0]?.value ??
    "";
  const primaryEmail =
    selectedCustomer?.emails?.find((email) => email.isPrimary)?.value ??
    selectedCustomer?.emails?.[0]?.value ??
    "";

  const fetchConversations = React.useCallback(async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<ConversationsResponse>(
        `/api/crm/inbox/conversations?limit=${CONVERSATIONS_PAGE_SIZE}&offset=0`
      );
      setConversations(response.data);
      setMeta(response.meta);
      if (!selectedCustomerId && response.data[0]?.customerId) {
        setSelectedCustomerId(response.data[0].customerId);
      }
    } catch (fetchError) {
      setError(getApiErrorMessage(fetchError));
    } finally {
      setLoading(false);
    }
  }, [canRead, selectedCustomerId]);

  const fetchMessages = React.useCallback(async (customerId: string) => {
    setMessagesLoading(true);
    try {
      const response = await apiFetch<InboxThreadResponse>(
        `/api/crm/inbox/conversations/${customerId}/messages?limit=50&offset=0`
      );
      setMessages(response.data);
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const fetchSelectedContext = React.useCallback(async (customerId: string) => {
    setContextLoading(true);
    try {
      const [customerResponse, opportunityResponse] = await Promise.all([
        apiFetch<{ data: CustomerDetail }>(`/api/customers/${customerId}`),
        apiFetch<{ data: Opportunity[]; meta: { total: number } }>(
          `/api/crm/opportunities?customerId=${encodeURIComponent(customerId)}&limit=1&sortBy=updatedAt&sortOrder=desc`
        ),
      ]);
      setSelectedCustomer(customerResponse.data);
      setSelectedOpportunity(opportunityResponse.data[0] ?? null);
    } catch {
      setSelectedCustomer(null);
      setSelectedOpportunity(null);
    } finally {
      setContextLoading(false);
    }
  }, []);

  const refreshSelectedContext = React.useCallback(async () => {
    if (!selectedCustomerId) return;
    await Promise.all([
      fetchMessages(selectedCustomerId),
      fetchSelectedContext(selectedCustomerId),
      fetchConversations(),
    ]);
  }, [fetchConversations, fetchMessages, fetchSelectedContext, selectedCustomerId]);

  React.useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  React.useEffect(() => {
    const customerIdFromQuery = searchParams.get("customerId") ?? initialCustomerId;
    if (customerIdFromQuery) {
      setSelectedCustomerId(customerIdFromQuery);
    }
  }, [initialCustomerId, searchParams]);

  React.useEffect(() => {
    if (!selectedCustomerId) {
      setSelectedCustomer(null);
      setSelectedOpportunity(null);
      setMessages([]);
      return;
    }
    setQueueReturnNotice(null);
    void fetchSelectedContext(selectedCustomerId);
    void fetchMessages(selectedCustomerId);
  }, [fetchMessages, fetchSelectedContext, selectedCustomerId]);

  React.useEffect(() => {
    if (!selectedCustomerId) {
      setInboxSignals([]);
      return;
    }
    let mounted = true;
    fetchSignalsByDomains(["crm"], { limit: 30 })
      .then((signals) => {
        if (mounted) setInboxSignals(signals);
      })
      .catch(() => {
        if (mounted) setInboxSignals([]);
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
  const withReturnTo = React.useCallback(
    (href: string) => {
      if (!returnTo) return href;
      const [base, existingQuery = ""] = href.split("?");
      const params = new URLSearchParams(existingQuery);
      params.set("returnTo", returnTo);
      const nextQuery = params.toString();
      return nextQuery ? `${base}?${nextQuery}` : base;
    },
    [returnTo]
  );
  const buildQueueReturnHref = React.useCallback(() => {
    if (!returnTo) return null;
    const [base, existingQuery = ""] = returnTo.split("?");
    const params = new URLSearchParams(existingQuery);
    params.set("refreshed", "1");
    if (selectedCustomerId) params.set("workedCustomerId", selectedCustomerId);
    if (selectedOpportunity?.id) params.set("workedOpportunityId", selectedOpportunity.id);
    const nextQuery = params.toString();
    return nextQuery ? `${base}?${nextQuery}` : base;
  }, [returnTo, selectedCustomerId, selectedOpportunity?.id]);

  const dueNowCount = conversations.filter((conversation) => conversationQueueState(conversation).variant !== "neutral").length;
  const inboundCount = conversations.filter((conversation) => conversation.direction === "inbound").length;
  const waitingCount = conversations.filter((conversation) => conversation.direction === "outbound").length;
  const overdueReplyCount = conversations.filter((conversation) => conversationQueueState(conversation).label === "Overdue reply").length;

  const openSmsDialog = React.useCallback(() => {
    if (!primaryPhone.trim()) {
      addToast("error", "This customer has no phone number");
      return;
    }
    setSmsOpen(true);
  }, [addToast, primaryPhone]);

  const openEmailDialog = React.useCallback(() => {
    if (!primaryEmail.trim()) {
      addToast("error", "This customer has no email");
      return;
    }
    setEmailOpen(true);
  }, [addToast, primaryEmail]);

  const sendSms = async () => {
    if (!selectedCustomerId || !primaryPhone.trim() || !smsMessage.trim()) return;
    setActionLoading(true);
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
      setQueueReturnNotice("SMS sent. Return to the queue when you’re ready for the next conversation.");
      await refreshSelectedContext();
    } catch (sendError) {
      addToast("error", getApiErrorMessage(sendError));
    } finally {
      setActionLoading(false);
    }
  };

  const sendEmail = async () => {
    if (!selectedCustomerId || !primaryEmail.trim() || !emailSubject.trim() || !emailBody.trim()) return;
    setActionLoading(true);
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
      setQueueReturnNotice("Email sent. Return to the queue when you’re ready for the next conversation.");
      await refreshSelectedContext();
    } catch (sendError) {
      addToast("error", getApiErrorMessage(sendError));
    } finally {
      setActionLoading(false);
    }
  };

  const createTask = async () => {
    if (!selectedCustomerId || !taskTitle.trim()) return;
    setActionLoading(true);
    try {
      await apiFetch(`/api/customers/${selectedCustomerId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: taskTitle.trim(),
          ...(taskDueAt ? { dueAt: new Date(taskDueAt).toISOString() } : {}),
        }),
      });
      setTaskTitle("");
      setTaskDueAt("");
      setTaskOpen(false);
      addToast("success", "Task created");
      setQueueReturnNotice("Task created. Return to the queue when you’re ready for the next record.");
      await refreshSelectedContext();
    } catch (taskError) {
      addToast("error", getApiErrorMessage(taskError));
    } finally {
      setActionLoading(false);
    }
  };

  const createCallback = async () => {
    if (!selectedCustomerId || !callbackAt) return;
    setActionLoading(true);
    try {
      await apiFetch(`/api/customers/${selectedCustomerId}/callbacks`, {
        method: "POST",
        body: JSON.stringify({
          callbackAt: new Date(callbackAt).toISOString(),
          reason: callbackReason.trim() || undefined,
        }),
      });
      setCallbackAt("");
      setCallbackReason("");
      setCallbackOpen(false);
      addToast("success", "Callback scheduled");
      setQueueReturnNotice("Callback scheduled. Return to the queue when you’re ready for the next record.");
      await refreshSelectedContext();
    } catch (callbackError) {
      addToast("error", getApiErrorMessage(callbackError));
    } finally {
      setActionLoading(false);
    }
  };

  const logCall = async () => {
    if (!selectedCustomerId) return;
    setActionLoading(true);
    try {
      await apiFetch(`/api/customers/${selectedCustomerId}/calls`, {
        method: "POST",
        body: JSON.stringify({
          summary: callSummary.trim() || undefined,
          durationSeconds: Number(callDurationSeconds) || undefined,
          direction: "outbound",
        }),
      });
      setCallSummary("");
      setCallDurationSeconds("300");
      setCallOpen(false);
      addToast("success", "Call logged");
      setQueueReturnNotice("Call logged. Return to the queue when you’re ready for the next record.");
      await refreshSelectedContext();
    } catch (callError) {
      addToast("error", getApiErrorMessage(callError));
    } finally {
      setActionLoading(false);
    }
  };

  if (!canRead) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--text-soft)]">You don&apos;t have access to CRM inbox.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      fullWidth
      contentClassName="px-4 sm:px-6 lg:px-8 min-[1800px]:px-10 min-[2200px]:px-14"
      className="flex flex-col space-y-4 min-[1800px]:space-y-5"
    >
      <PageHeader
        title={
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
              CRM inbox
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-[44px]">
                Conversation execution
              </h1>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs font-medium text-[var(--muted-text)]">
                Customer and opportunity context in one place
              </span>
            </div>
          </div>
        }
        description="Work inbound replies, log live contact, and schedule the next touch without leaving the conversation."
        actions={
          selectedCustomerId ? (
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge variant={queueState.variant}>{queueState.label}</StatusBadge>
              {returnTo ? (
                <Link href={returnTo}>
                  <Button size="sm" variant="secondary">Back to queue</Button>
                </Link>
              ) : null}
              <Link href={withReturnTo(customerDetailPath(selectedCustomerId))}>
                <Button size="sm" variant="secondary">Customer</Button>
              </Link>
              {selectedOpportunity ? (
                <Link href={withReturnTo(`/crm/opportunities/${selectedOpportunity.id}`)}>
                  <Button size="sm" variant="secondary">Opportunity</Button>
                </Link>
              ) : null}
            </div>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Due now" value={dueNowCount.toLocaleString()} sub="conversations needing action" color="amber" accentValue={dueNowCount > 0} hasUpdate={dueNowCount > 0} trend={[dueNowCount || 1, dueNowCount || 1]} />
        <KpiCard label="Inbound" value={inboundCount.toLocaleString()} sub="customers waiting on a reply" color="blue" trend={[inboundCount || 1, inboundCount || 1]} />
        <KpiCard label="Waiting on customer" value={waitingCount.toLocaleString()} sub="outbound threads still pending" color="cyan" trend={[waitingCount || 1, waitingCount || 1]} />
        <KpiCard label="Overdue reply" value={overdueReplyCount.toLocaleString()} sub="inbound older than 4 hours" color="violet" accentValue={overdueReplyCount > 0} hasUpdate={overdueReplyCount > 0} trend={[overdueReplyCount || 1, overdueReplyCount || 1]} />
      </div>

      <div className="grid gap-4 min-[1600px]:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.45fr)_minmax(320px,0.82fr)]">
        <aside className="surface-noise overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
              Queue
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Conversations</h2>
            <p className="mt-1 text-sm text-[var(--muted-text)]">
              {meta.total.toLocaleString()}
              {meta.totalIsExact ? "" : "+"} active threads
            </p>
          </div>
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-4">
              <ErrorState message={error} onRetry={fetchConversations} />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No conversations" description="SMS and email threads will appear here once customers start responding." />
            </div>
          ) : (
            <ul className="max-h-[calc(100vh-19rem)] divide-y divide-[var(--border)] overflow-y-auto" role="list">
              {conversations.map((conversation) => {
                const state = conversationQueueState(conversation);
                return (
                  <li key={conversation.customerId}>
                    <Link
                      href={withReturnTo(`/crm/inbox?customerId=${encodeURIComponent(conversation.customerId)}`)}
                      onClick={() => setSelectedCustomerId(conversation.customerId)}
                      className={cn(
                        "block px-4 py-3 transition-colors hover:bg-[var(--surface-2)]",
                        selectedCustomerId === conversation.customerId
                          ? "border-l-2 border-[var(--accent)] bg-[var(--surface-2)]"
                          : ""
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--text)]">
                            {conversation.customerName}
                          </p>
                          <p className="mt-1 truncate text-sm text-[var(--muted-text)]">
                            {conversation.lastMessagePreview || `${conversation.channel} ${conversation.direction}`}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[11px] font-medium text-[var(--text-soft)]">
                            {formatMessageTime(conversation.lastMessageAt)}
                          </p>
                          <div className="mt-2">
                            <StatusBadge variant={state.variant}>{state.label}</StatusBadge>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <main className="surface-noise overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
          {!selectedCustomerId ? (
            <div className="flex min-h-[520px] items-center justify-center">
              <EmptyState title="Select a conversation" description="Choose a thread from the queue to open the customer context and reply surface." />
            </div>
          ) : (
            <>
              <div className="border-b border-[var(--border)] px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--text)]">
                        {selectedName}
                      </h2>
                      <StatusBadge variant={queueState.variant}>{queueState.label}</StatusBadge>
                      {selectedCustomer?.status ? (
                        <StatusBadge variant="info">{selectedCustomer.status}</StatusBadge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted-text)]">
                      {selectedConversation?.channel.toUpperCase()} thread · last touched{" "}
                      {selectedConversation ? formatMessageTime(selectedConversation.lastMessageAt) : "recently"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={openSmsDialog} disabled={!canWrite}>Send SMS</Button>
                    <Button size="sm" variant="secondary" onClick={openEmailDialog} disabled={!canWrite}>Send email</Button>
                    <Button size="sm" variant="secondary" onClick={() => setCallOpen(true)} disabled={!canWrite}>Log call</Button>
                  </div>
                </div>
              </div>

              <div className="flex min-h-[520px] flex-col">
                {returnTo && queueReturnNotice ? (
                  <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-[var(--text)]">{queueReturnNotice}</p>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setQueueReturnNotice(null)}>
                          Stay here
                        </Button>
                        <Link href={buildQueueReturnHref() ?? returnTo}>
                          <Button size="sm">Return to queue</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="border-b border-[var(--border)] px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setCallbackOpen(true)} disabled={!canWrite}>
                      Schedule callback
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setTaskOpen(true)} disabled={!canWrite}>
                      Create task
                    </Button>
                    <Link href={withReturnTo(customerDetailPath(selectedCustomerId))}>
                      <Button size="sm" variant="secondary">Open customer record</Button>
                    </Link>
                    {selectedOpportunity ? (
                      <Link href={withReturnTo(`/crm/opportunities/${selectedOpportunity.id}`)}>
                        <Button size="sm" variant="secondary">Open opportunity</Button>
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {messagesLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-[75%]" />
                      <Skeleton className="ml-auto h-16 w-[70%]" />
                      <Skeleton className="h-16 w-[68%]" />
                    </div>
                  ) : messages.length === 0 ? (
                    <EmptyState title="No messages" description="Reply from this workspace to create the first inbox timeline entry." />
                  ) : (
                    <div className="space-y-3">
                      {messages.map((message) => {
                        const inbound = message.direction === "inbound";
                        return (
                          <div
                            key={message.id}
                            className={cn(
                              "max-w-[85%] rounded-[18px] border px-4 py-3",
                              inbound
                                ? "border-[var(--border)] bg-[var(--surface-2)]"
                                : "ml-auto border-[var(--accent)]/25 bg-[var(--accent)]/10"
                            )}
                          >
                            <div className="mb-1 text-[11px] font-medium text-[var(--text-soft)]">
                              {formatMessageTime(message.createdAt)} ·{" "}
                              {message.channel === "email" ? "Email" : "SMS"} ·{" "}
                              {inbound ? "Inbound" : "Outbound"}
                            </div>
                            <p className="text-sm text-[var(--text)]">
                              {formatEventPreview(message) || "No preview available"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </main>

        <aside className="space-y-3">
          <Widget compact title="Customer context" subtitle="Identity, stage, and contact details without leaving the conversation.">
            {contextLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : !selectedCustomer ? (
              <div className="py-4 text-sm text-[var(--muted-text)]">
                Select a customer conversation to load contact context.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">Stage</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text)]">{selectedCustomer.status}</p>
                  </div>
                  <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">Lead source</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text)]">{selectedCustomer.leadSource ?? "Unknown"}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-[var(--text)]"><strong>Phone:</strong> {primaryPhone || "No phone on file"}</p>
                  <p className="text-[var(--text)]"><strong>Email:</strong> {primaryEmail || "No email on file"}</p>
                  <p className="text-[var(--text)]"><strong>Owner:</strong> {selectedCustomer.assignedToProfile?.fullName ?? selectedCustomer.assignedToProfile?.email ?? "Unassigned"}</p>
                </div>
              </div>
            )}
          </Widget>

          <Widget compact title="Active opportunity" subtitle="Pipeline context so a rep knows the current deal state before responding.">
            {!selectedOpportunity ? (
              <div className="py-4 text-sm text-[var(--muted-text)]">No open opportunity is linked to this customer.</div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Link href={withReturnTo(`/crm/opportunities/${selectedOpportunity.id}`)} className="text-base font-semibold text-[var(--text)] hover:text-[var(--accent)]">
                    {selectedOpportunity.stage?.name ?? "Open opportunity"}
                  </Link>
                  <p className="mt-1 text-sm text-[var(--muted-text)]">
                    {selectedOpportunity.owner?.fullName ?? selectedOpportunity.owner?.email ?? "Unassigned"} · {selectedOpportunity.source ?? "No source"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">Next action</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text)]">{selectedOpportunity.nextActionText ?? "Not set"}</p>
                  </div>
                  <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">Est. value</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                      {selectedOpportunity.estimatedValueCents ? formatCents(selectedOpportunity.estimatedValueCents) : "—"}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-[var(--muted-text)]">
                  {selectedOpportunity.nextActionAt
                    ? `Due ${new Date(selectedOpportunity.nextActionAt).toLocaleString()}`
                    : "No due date is committed yet."}
                </p>
              </div>
            )}
          </Widget>

          <Widget compact title="Next action block" subtitle="Direct shortcuts for the standard rep workflow.">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setTaskOpen(true)} disabled={!canWrite}>Add task</Button>
              <Button size="sm" variant="secondary" onClick={() => setCallbackOpen(true)} disabled={!canWrite}>Schedule callback</Button>
              <Button size="sm" variant="secondary" onClick={() => setCallOpen(true)} disabled={!canWrite}>Log call</Button>
              <Button size="sm" variant="secondary" onClick={openSmsDialog} disabled={!canWrite}>Reply SMS</Button>
              <Button size="sm" variant="secondary" onClick={openEmailDialog} disabled={!canWrite}>Reply email</Button>
            </div>
          </Widget>

          {customerContextSignals.length > 0 ? (
            <SignalContextBlock title="Customer alerts" items={customerContextSignals} />
          ) : null}
        </aside>
      </div>

      <Dialog open={smsOpen} onOpenChange={setSmsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send SMS</DialogTitle>
            <DialogDescription>Message will be sent via Twilio and logged to the customer timeline.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-[var(--text)]">To</label>
              <Input value={primaryPhone} readOnly className="mt-1 bg-[var(--muted)]" />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text)]">Message</label>
              <textarea
                value={smsMessage}
                onChange={(event) => setSmsMessage(event.target.value)}
                placeholder="Type your message..."
                className="mt-1 min-h-[120px] w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSmsOpen(false)}>Cancel</Button>
            <Button onClick={sendSms} disabled={actionLoading || !smsMessage.trim()}>{actionLoading ? "Sending…" : "Send"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send email</DialogTitle>
            <DialogDescription>Email will be sent via SendGrid and logged to the customer timeline.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-[var(--text)]">To</label>
              <Input value={primaryEmail} readOnly className="mt-1 bg-[var(--muted)]" />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text)]">Subject</label>
              <Input value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} placeholder="Subject" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text)]">Body</label>
              <textarea
                value={emailBody}
                onChange={(event) => setEmailBody(event.target.value)}
                placeholder="Message..."
                className="mt-1 min-h-[140px] w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEmailOpen(false)}>Cancel</Button>
            <Button onClick={sendEmail} disabled={actionLoading || !emailSubject.trim() || !emailBody.trim()}>{actionLoading ? "Sending…" : "Send"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create follow-up task</DialogTitle>
            <DialogDescription>Add the next explicit task for this customer without leaving the inbox.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-[var(--text)]">Title</label>
              <Input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Call back with pricing update" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text)]">Due at</label>
              <Input type="datetime-local" value={taskDueAt} onChange={(event) => setTaskDueAt(event.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setTaskOpen(false)}>Cancel</Button>
            <Button onClick={createTask} disabled={actionLoading || !taskTitle.trim()}>{actionLoading ? "Saving…" : "Create task"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={callbackOpen} onOpenChange={setCallbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule callback</DialogTitle>
            <DialogDescription>Set the next follow-up commitment directly from the conversation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-[var(--text)]">Callback time</label>
              <Input type="datetime-local" value={callbackAt} onChange={(event) => setCallbackAt(event.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text)]">Reason</label>
              <Input value={callbackReason} onChange={(event) => setCallbackReason(event.target.value)} placeholder="Confirm appointment availability" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCallbackOpen(false)}>Cancel</Button>
            <Button onClick={createCallback} disabled={actionLoading || !callbackAt}>{actionLoading ? "Scheduling…" : "Schedule callback"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={callOpen} onOpenChange={setCallOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log call</DialogTitle>
            <DialogDescription>Capture a live phone touch so the timeline and last-visit history stay current.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-[var(--text)]">Summary</label>
              <textarea
                value={callSummary}
                onChange={(event) => setCallSummary(event.target.value)}
                placeholder="Discussed trade-in range and next appointment."
                className="mt-1 min-h-[110px] w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                rows={4}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text)]">Duration (seconds)</label>
              <Input value={callDurationSeconds} onChange={(event) => setCallDurationSeconds(event.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCallOpen(false)}>Cancel</Button>
            <Button onClick={logCall} disabled={actionLoading}>{actionLoading ? "Saving…" : "Log call"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
