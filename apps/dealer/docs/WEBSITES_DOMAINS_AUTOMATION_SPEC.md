# Websites Custom Domain and SSL Automation Spec

**Sprint**: Websites Platform Scale-Up  
**Date**: 2026-03-13  
**Parent**: WEBSITES_SCALEUP_SPEC.md (Track 3)

---

## 1. Goal

Establish **automation-ready** foundations for custom domain verification and SSL lifecycle. Implement only what the repo and infrastructure can truthfully support; do not promise zero-touch DNS/SSL if not implemented.

---

## 2. Current State

### 2.1 Schema (WebsiteDomain)

- hostname, siteId, dealershipId, isPrimary, isSubdomain
- **verificationStatus**: PENDING | VERIFIED | FAILED
- **sslStatus**: PENDING | PROVISIONED | FAILED | NOT_APPLICABLE
- No `lastVerifiedAt` / `lastSslCheckAt` (optional add).

### 2.2 Behavior Today

- **Platform subdomains**: Created with VERIFIED + PROVISIONED (no real DNS/SSL check; platform controls subdomain).
- **Custom domains**: Created with PENDING + PENDING. Dealer or operator must manually update verificationStatus and sslStatus via PATCH (e.g. after adding DNS records and provisioning certificate elsewhere).
- No provider abstraction; no async verification or SSL provisioning jobs.

---

## 3. Lifecycle and States

### 3.1 Verification Lifecycle

- **PENDING**: Domain added; verification not yet run or not yet passed.
- **VERIFIED**: Ownership/control verified (e.g. TXT or CNAME check succeeded).
- **FAILED**: Verification attempted and failed (wrong record, timeout, etc.).

### 3.2 SSL Lifecycle

- **PENDING**: Certificate not yet requested or not yet issued.
- **PROVISIONED**: Certificate issued and (optionally) installed for the hostname.
- **FAILED**: Provisioning attempted and failed.
- **NOT_APPLICABLE**: e.g. platform subdomain where SSL is handled by platform; or custom domain not yet verified.

### 3.3 Optional Schema Additions

- **lastVerifiedAt** (DateTime?): Last time verification check was run (for UI “Last checked” and idempotent refresh).
- **lastSslCheckAt** (DateTime?): Last time SSL status was checked or provisioned.
- **verificationError** (String?, optional): Last verification failure reason for UI.
- **sslError** (String?, optional): Last SSL failure reason.

---

## 4. Provider Abstraction

### 4.1 DNS / Verification Provider

- **Interface**: e.g. `checkDomainVerification(hostname: string, expectedTxt?: string): Promise<{ status: "verified" | "pending" | "failed"; error?: string }>`.
- **Implementations**:
  - **Stub**: Always returns `pending` or `verified` (for testing or when no provider configured).
  - **Real**: When DNS_PROVIDER (or similar) is set, perform TXT/CNAME lookup (or call provider API) and return result.
- **Location**: e.g. `modules/websites-domains/providers/dns.ts` or `verification.ts`.

### 4.2 SSL Provider

- **Interface**: e.g. `provisionSsl(hostname: string): Promise<{ status: "provisioned" | "pending" | "failed"; error?: string }>` and/or `checkSslStatus(hostname: string): Promise<...>`.
- **Implementations**:
  - **Stub**: Always returns `pending` or `not_applicable`.
  - **Real**: When SSL_PROVIDER (e.g. Let’s Encrypt, Vercel, or platform proxy) is configured, call provider and return result.
- **Location**: e.g. `modules/websites-domains/providers/ssl.ts`.

### 4.3 Configuration

- Env: e.g. `WEBSITES_DNS_VERIFICATION_PROVIDER` (none | stub | acme-dns), `WEBSITES_SSL_PROVIDER` (none | stub | letsencrypt | platform). When “none” or unset, use stub; no external calls.
- Document in this spec and in deployment runbook what is required for real automation.

---

## 5. API and Workflows

### 5.1 Refresh Verification

- **Endpoint**: e.g. `POST /api/websites/domains/[domainId]/verify` or `POST .../refresh-verification`.
- **Permission**: `websites.write`.
- **Flow**: Load domain (tenant-scoped); call verification provider; update verificationStatus (and optional lastVerifiedAt, verificationError). Return updated domain.
- **Idempotent**: Safe to call multiple times.

### 5.2 Refresh SSL Status

- **Endpoint**: e.g. `POST /api/websites/domains/[domainId]/refresh-ssl` or `POST .../check-ssl`.
- **Permission**: `websites.write`.
- **Flow**: Load domain; call SSL provider (check or provision); update sslStatus (and optional lastSslCheckAt, sslError). Return updated domain.
- **Idempotent**: Safe to call multiple times.

### 5.3 Manual Override

- Existing PATCH `/api/websites/domains/[domainId]` continues to allow updating verificationStatus and sslStatus manually (for operators who configure DNS/SSL outside the system).

---

## 6. Async Jobs (Optional)

- **When**: If verification or SSL check is slow or depends on external API, can enqueue a BullMQ job (e.g. `websiteDomainVerify`) that calls provider and updates domain.
- **Trigger**: From “Refresh verification” API: enqueue job and return 202 with “status: pending”; worker updates domain when done. Or sync in API for simplicity in sprint.
- **Recommendation**: Start with **sync** refresh in API; add async job in a follow-up if needed (e.g. for rate limits or long-running ACME).

---

## 7. Public Resolver Safety

- **Unchanged**: Hostname-based resolution in `resolveSiteByHostname` remains the only way to resolve tenant for public routes. Custom domain and subdomain are both just hostnames in `WebsiteDomain`.
- **No** client-supplied dealershipId or siteId in public resolution. Verification/SSL state is for dealer/operator UX and for platform to know if a custom domain is “ready”; it does not change public resolution semantics.

---

## 8. Implementation Plan (Step 2)

1. **Schema** (optional): Add lastVerifiedAt, lastSslCheckAt (and optional error fields); migration.
2. **Providers**: Add `providers/dns.ts` and `providers/ssl.ts` with stub implementations; env to switch to real when available.
3. **APIs**: Add POST refresh-verification and refresh-ssl for domain; permission websites.write; call provider and update domain.
4. **UI** (Step 3): Domain management page shows verification and SSL status; “Check again” / “Refresh” buttons that call new APIs.
5. **Documentation**: Update this spec and runbook with “what is automated” vs “manual” and required env for automation.

---

## 9. What Is Automated vs Manual (Honest Boundary)

| Action | Automated (when configured) | Manual fallback |
|--------|-----------------------------|------------------|
| Domain verification | Provider checks TXT/CNAME; API updates status. | Operator sets DNS; clicks “Refresh verification” or PATCH status. |
| SSL provisioning | Provider issues/installs cert; API updates status. | Operator provisions cert elsewhere; PATCH sslStatus. |
| DNS record creation | Out of scope (no auto-create of CNAME/A in this sprint). | Operator adds CNAME/A at DNS host. |

“Automation-ready” means: the **lifecycle and provider interfaces** are in place so that when a real DNS/SSL provider is integrated, the same APIs and jobs can drive it. This sprint may ship only stub providers and manual refresh.
