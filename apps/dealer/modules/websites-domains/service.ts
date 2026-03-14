import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForWrite } from "@/lib/tenant-status";
import * as dnsProvider from "./providers/dns";
import * as sslProvider from "./providers/ssl";

const PLATFORM_SUBDOMAIN_BASE = process.env.PLATFORM_SUBDOMAIN_BASE ?? "dms-platform.com";

export function buildSubdomainHostname(subdomain: string): string {
  return `${subdomain}.${PLATFORM_SUBDOMAIN_BASE}`;
}

export async function allocatePlatformSubdomain(
  dealershipId: string,
  siteId: string,
  subdomain: string,
  _meta?: { ip?: string; userAgent?: string }
) {
  const hostname = buildSubdomainHostname(subdomain);
  await prisma.websiteDomain.create({
    data: {
      siteId,
      dealershipId,
      hostname,
      isPrimary: true,
      isSubdomain: true,
      verificationStatus: "VERIFIED",
      sslStatus: "PROVISIONED",
    },
  });
  return hostname;
}

export async function addCustomDomain(
  dealershipId: string,
  siteId: string,
  hostname: string,
  isPrimary: boolean,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const normalized = hostname.toLowerCase();

  const existing = await prisma.websiteDomain.findUnique({
    where: { hostname: normalized } as { hostname: string },
  });
  if (existing) throw new ApiError("CONFLICT", "Hostname is already registered");

  return prisma.websiteDomain.create({
    data: {
      siteId,
      dealershipId,
      hostname: normalized,
      isPrimary,
      isSubdomain: false,
      verificationStatus: "PENDING",
      sslStatus: "PENDING",
    },
  });
}

export async function updateDomain(
  dealershipId: string,
  domainId: string,
  data: {
    isPrimary?: boolean;
    verificationStatus?: "PENDING" | "VERIFIED" | "FAILED";
    sslStatus?: "PENDING" | "PROVISIONED" | "FAILED" | "NOT_APPLICABLE";
  }
) {
  await requireTenantActiveForWrite(dealershipId);
  const domain = await prisma.websiteDomain.findFirst({
    where: { id: domainId, dealershipId },
  });
  if (!domain) throw new ApiError("NOT_FOUND", "Domain not found");

  return prisma.websiteDomain.update({
    where: { id: domainId },
    data: {
      ...(data.isPrimary !== undefined && { isPrimary: data.isPrimary }),
      ...(data.verificationStatus !== undefined && { verificationStatus: data.verificationStatus }),
      ...(data.sslStatus !== undefined && { sslStatus: data.sslStatus }),
    },
  });
}

export async function listDomains(dealershipId: string, siteId: string) {
  return prisma.websiteDomain.findMany({
    where: { siteId, dealershipId },
    orderBy: { isPrimary: "desc" },
  });
}

/**
 * Resolves the site for a given hostname (used by public runtime).
 * Returns null if no matching published site is found.
 */
export async function resolveSiteByHostname(hostname: string) {
  const normalized = hostname
    .toLowerCase()
    .replace(/:\d+$/, "")   // strip port
    .replace(/\.+$/, "")    // strip trailing dots
    .replace(/^www\./, ""); // strip www. prefix
  const domain = await prisma.websiteDomain.findFirst({
    where: { hostname: normalized },
    include: {
      site: {
        include: {
          publishedRelease: true,
          domains: { where: { isPrimary: true }, take: 1 },
        },
      },
    },
  });
  if (!domain?.site) return null;
  if (!domain.site.publishedReleaseId || !domain.site.publishedRelease) return null;
  return { site: domain.site, release: domain.site.publishedRelease };
}

/**
 * Refresh domain verification status using the DNS provider (stub or real).
 */
export async function refreshDomainVerification(dealershipId: string, domainId: string) {
  await requireTenantActiveForWrite(dealershipId);
  const domain = await prisma.websiteDomain.findFirst({
    where: { id: domainId, dealershipId },
  });
  if (!domain) throw new ApiError("NOT_FOUND", "Domain not found");

  const result = await dnsProvider.checkDomainVerification(domain.hostname);
  const verificationStatus =
    result.status === "verified"
      ? "VERIFIED"
      : result.status === "failed"
        ? "FAILED"
        : "PENDING";

  return prisma.websiteDomain.update({
    where: { id: domainId },
    data: { verificationStatus },
  });
}

/**
 * Refresh SSL status using the SSL provider (stub or real).
 */
export async function refreshDomainSsl(dealershipId: string, domainId: string) {
  await requireTenantActiveForWrite(dealershipId);
  const domain = await prisma.websiteDomain.findFirst({
    where: { id: domainId, dealershipId },
  });
  if (!domain) throw new ApiError("NOT_FOUND", "Domain not found");

  const result = await sslProvider.checkSslStatus(domain.hostname);
  const sslStatus =
    result.status === "provisioned"
      ? "PROVISIONED"
      : result.status === "failed"
        ? "FAILED"
        : result.status === "not_applicable"
          ? "NOT_APPLICABLE"
          : "PENDING";

  return prisma.websiteDomain.update({
    where: { id: domainId },
    data: { sslStatus },
  });
}
