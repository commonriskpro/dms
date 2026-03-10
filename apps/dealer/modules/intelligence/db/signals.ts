import { prisma } from "@/lib/db";
import type {
  IntelligenceSignal,
  IntelligenceSignalDomain,
  IntelligenceSignalSeverity,
} from "@prisma/client";

export const signalDomains = [
  "inventory",
  "crm",
  "deals",
  "operations",
  "acquisition",
] as const;

export type SignalDomain = (typeof signalDomains)[number];
export type SignalSeverity = "info" | "success" | "warning" | "danger";

type DedupeKey = {
  dealershipId: string;
  domain: SignalDomain;
  code: string;
  entityType?: string | null;
  entityId?: string | null;
};

export type UpsertSignalInput = DedupeKey & {
  severity: SignalSeverity;
  title: string;
  description?: string | null;
  actionLabel?: string | null;
  actionHref?: string | null;
  metadata?: unknown;
  happenedAt?: Date;
};

export type ListSignalsInput = {
  dealershipId: string;
  domain?: SignalDomain;
  severity?: SignalSeverity;
  includeResolved?: boolean;
  limit: number;
  offset: number;
};

function toDomainEnum(domain: SignalDomain): IntelligenceSignalDomain {
  switch (domain) {
    case "inventory":
      return "INVENTORY";
    case "crm":
      return "CRM";
    case "deals":
      return "DEALS";
    case "operations":
      return "OPERATIONS";
    case "acquisition":
      return "ACQUISITION";
  }
}

function toSeverityEnum(severity: SignalSeverity): IntelligenceSignalSeverity {
  switch (severity) {
    case "info":
      return "INFO";
    case "success":
      return "SUCCESS";
    case "warning":
      return "WARNING";
    case "danger":
      return "DANGER";
  }
}

function normalizeNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function areEqualMetadata(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function mapToActiveWhere(input: DedupeKey) {
  return {
    dealershipId: input.dealershipId,
    domain: toDomainEnum(input.domain),
    code: input.code,
    entityType: normalizeNullable(input.entityType),
    entityId: input.entityId ?? null,
    resolvedAt: null,
    deletedAt: null,
  };
}

export async function upsertActiveSignal(
  input: UpsertSignalInput
): Promise<{ action: "created" | "updated" | "unchanged"; signal: IntelligenceSignal }> {
  const domain = toDomainEnum(input.domain);
  const severity = toSeverityEnum(input.severity);
  const entityType = normalizeNullable(input.entityType);
  const entityId = input.entityId ?? null;
  const happenedAt = input.happenedAt ?? new Date();
  const where = mapToActiveWhere(input);

  const existing = await prisma.intelligenceSignal.findFirst({ where });
  if (existing) {
    const changed =
      existing.severity !== severity ||
      existing.title !== input.title ||
      (existing.description ?? null) !== (input.description ?? null) ||
      (existing.actionLabel ?? null) !== (input.actionLabel ?? null) ||
      (existing.actionHref ?? null) !== (input.actionHref ?? null) ||
      !areEqualMetadata(existing.metadata, input.metadata);

    if (!changed) {
      return { action: "unchanged", signal: existing };
    }

    const updated = await prisma.intelligenceSignal.update({
      where: { id: existing.id },
      data: {
        severity,
        title: input.title,
        description: input.description ?? null,
        actionLabel: input.actionLabel ?? null,
        actionHref: input.actionHref ?? null,
        metadata: input.metadata as object | undefined,
        happenedAt,
      },
    });
    return { action: "updated", signal: updated };
  }

  try {
    const created = await prisma.intelligenceSignal.create({
      data: {
        dealershipId: input.dealershipId,
        domain,
        code: input.code,
        severity,
        title: input.title,
        description: input.description ?? null,
        entityType,
        entityId,
        actionLabel: input.actionLabel ?? null,
        actionHref: input.actionHref ?? null,
        metadata: input.metadata as object | undefined,
        happenedAt,
      },
    });
    return { action: "created", signal: created };
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code !== "P2002") throw e;

    const raced = await prisma.intelligenceSignal.findFirst({ where });
    if (!raced) throw e;
    return { action: "unchanged", signal: raced };
  }
}

export async function resolveActiveSignalByCode(
  dealershipId: string,
  domain: SignalDomain,
  code: string
): Promise<number> {
  const now = new Date();
  const result = await prisma.intelligenceSignal.updateMany({
    where: {
      dealershipId,
      domain: toDomainEnum(domain),
      code,
      resolvedAt: null,
      deletedAt: null,
    },
    data: {
      resolvedAt: now,
    },
  });
  return result.count;
}

export async function listSignals(input: ListSignalsInput): Promise<{ data: IntelligenceSignal[]; total: number }> {
  const where = {
    dealershipId: input.dealershipId,
    ...(input.domain ? { domain: toDomainEnum(input.domain) } : {}),
    ...(input.severity ? { severity: toSeverityEnum(input.severity) } : {}),
    ...(input.includeResolved ? {} : { resolvedAt: null }),
    deletedAt: null,
  };

  const [data, total] = await prisma.$transaction([
    prisma.intelligenceSignal.findMany({
      where,
      orderBy: [{ happenedAt: "desc" }, { createdAt: "desc" }],
      take: input.limit,
      skip: input.offset,
    }),
    prisma.intelligenceSignal.count({ where }),
  ]);

  return { data, total };
}
