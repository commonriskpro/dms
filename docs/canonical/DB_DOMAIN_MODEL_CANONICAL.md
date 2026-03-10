# DB Domain Model Canonical

This file documents the current Prisma-backed data model as implemented.

Database split:
- Dealer domain DB: `apps/dealer/prisma/schema.prisma`
- Platform control-plane DB: `apps/platform/prisma/schema.prisma`

## 1. Dealer Database Overview

Dealer schema size:
- 96 Prisma models
- Multi-tenant business system keyed around `Dealership`

### Core tenancy and access control

Primary models:
- `Dealership`
- `DealershipOnboardingState`
- `DealershipLocation`
- `Profile`
- `DealershipInvite`
- `PendingApproval`
- `Permission`
- `Role`
- `RolePermission`
- `Membership`
- `UserActiveDealership`
- `UserRole`
- `UserPermissionOverride`
- `AuditLog`

Ownership notes:
- `Dealership` is the top-level tenant entity for dealer-side business data.
- `Membership` ties a user/profile to a dealership.
- Effective permissions are derived from role grants plus user-level overrides.

Important states:
- `DealershipLifecycleStatus`: `ACTIVE`, `SUSPENDED`, `CLOSED`
- `DealershipInviteStatus`: `PENDING`, `ACCEPTED`, `EXPIRED`, `CANCELLED`

### Dealer application and provisioning support

Primary models:
- `DealerApplication`
- `DealerApplicationProfile`
- `ProvisioningIdempotency`
- `InternalApiJti`
- `OwnerInviteIdempotency`

Important states:
- `DealerApplicationSource`: `invite`, `public_apply`
- `DealerApplicationStatus`: `draft`, `invited`, `submitted`, `under_review`, `approved`, `rejected`, `activation_sent`, `activated`

Purpose:
- Support public/invite application intake, platform-side provisioning handoff, and idempotent internal operations.

### Inventory and acquisition

Primary models:
- `Vehicle`
- `VehiclePhoto`
- `VehicleCostEntry`
- `VehicleCostDocument`
- `BulkImportJob`
- `InventoryAlertDismissal`
- `VehicleVinDecode`
- `VehicleValuation`
- `VehicleRecon`
- `VehicleReconLineItem`
- `VehicleFloorplan`
- `VehicleFloorplanCurtailment`
- `VinDecodeCache`
- `VehicleBookValue`
- `VehicleAppraisal`
- `InventorySourceLead`
- `AuctionListingCache`
- `AuctionPurchase`
- `VehicleMarketValuation`
- `PricingRule`
- `VehicleListing`
- `ReconItem`
- `FloorplanLoan`
- `Vendor`
- `FileObject`

Important states and enums:
- `VehicleStatus`: `AVAILABLE`, `HOLD`, `SOLD`, `WHOLESALE`, `REPAIR`, `ARCHIVED`
- `VehicleReconStatus`: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETE`
- `BulkImportJobStatus`: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`
- `InventoryAlertType`: `MISSING_PHOTOS`, `STALE`, `RECON_OVERDUE`
- `VehicleAppraisalSourceType`: `TRADE_IN`, `AUCTION`, `MARKETPLACE`, `STREET`
- `VehicleAppraisalStatus`: `DRAFT`, `APPROVED`, `REJECTED`, `PURCHASED`, `CONVERTED`
- `InventorySourceLeadStatus`: `NEW`, `CONTACTED`, `NEGOTIATING`, `WON`, `LOST`
- `AuctionProvider`: `COPART`, `IAAI`, `MANHEIM`, `ACV`, `MOCK`
- `AuctionPurchaseStatus`: `PENDING`, `IN_TRANSIT`, `RECEIVED`, `CANCELLED`
- `PricingRuleType`: `AGE_BASED`, `MARKET_BASED`, `CLEARANCE`
- `VehicleListingPlatform`: `WEBSITE`, `AUTOTRADER`, `CARS`, `CARFAX`, `FACEBOOK`
- `VehicleListingStatus`: `DRAFT`, `PUBLISHED`, `FAILED`, `UNPUBLISHED`
- `ReconItemStatus`: `PENDING`, `IN_PROGRESS`, `COMPLETED`
- `FloorplanLoanStatus`: `ACTIVE`, `PAID_OFF`, `SOLD`

Current implementation notes:
- Listings are modeled for multi-platform publication, but current code only manages internal listing/feed state.
- Auction model supports multiple providers, but service code currently uses mock-provider behavior.

### Customers and CRM

Primary models:
- `Customer`
- `SavedFilter`
- `SavedSearch`
- `CustomerPhone`
- `CustomerEmail`
- `CustomerNote`
- `CustomerTask`
- `CustomerActivity`
- `CustomerCallback`
- `Pipeline`
- `Stage`
- `Opportunity`
- `OpportunityActivity`
- `AutomationRule`
- `AutomationRun`
- `Job`
- `DealerJobRun`
- `DealerJobRunsDaily`
- `SequenceTemplate`
- `SequenceStep`
- `SequenceInstance`
- `SequenceStepInstance`

Important states and enums:
- `CustomerStatus`: `LEAD`, `ACTIVE`, `SOLD`, `INACTIVE`
- `SavedFilterVisibility`: `PERSONAL`, `SHARED`
- `CustomerCallbackStatus`: `SCHEDULED`, `DONE`, `CANCELLED`
- `OpportunityStatus`: `OPEN`, `WON`, `LOST`
- `JobStatus`: `pending`, `running`, `completed`, `failed`, `dead_letter`
- `SequenceInstanceStatus`: `active`, `paused`, `stopped`, `completed`
- `SequenceStepInstanceStatus`: `pending`, `skipped`, `completed`, `failed`

Ownership notes:
- CRM is strongly customer-linked but not limited to customer-only entities; opportunities, stages, and automations are first-class tables.
- Job telemetry is persisted in dealer DB, not only in Redis.

### Deals and finance

Primary models:
- `Deal`
- `DealTitle`
- `DealDmvChecklistItem`
- `DealFee`
- `DealTrade`
- `DealHistory`
- `DealFunding`
- `DealFinance`
- `DealFinanceProduct`
- `Lender`
- `FinanceApplication`
- `FinanceApplicant`
- `FinanceSubmission`
- `FinanceStipulation`
- `CreditApplication`
- `LenderApplication`
- `LenderStipulation`
- `DealDocument`
- `ComplianceFormInstance`

Important states and enums:
- `DealStatus`: `DRAFT`, `STRUCTURED`, `APPROVED`, `CONTRACTED`, `CANCELED`
- `DeliveryStatus`: `READY_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`
- `DealFundingStatus`: `NONE`, `PENDING`, `APPROVED`, `FUNDED`, `FAILED`
- `TitleStatus`: `NOT_STARTED`, `TITLE_PENDING`, `TITLE_SENT`, `TITLE_RECEIVED`, `TITLE_COMPLETED`, `ISSUE_HOLD`
- `FinancingMode`: `CASH`, `FINANCE`
- `DealFinanceStatus`: `DRAFT`, `STRUCTURED`, `PRESENTED`, `ACCEPTED`, `CONTRACTED`, `CANCELED`
- `DealFinanceProductType`: `GAP`, `VSC`, `MAINTENANCE`, `TIRE_WHEEL`, `OTHER`
- `LenderType`: `BANK`, `CREDIT_UNION`, `CAPTIVE`, `OTHER`
- `LenderExternalSystem`: `NONE`, `ROUTEONE`, `DEALERTRACK`, `CUDL`, `OTHER`
- `FinanceApplicationStatus`: `DRAFT`, `COMPLETED`
- `FinanceApplicantRole`: `PRIMARY`, `CO`
- `FinanceSubmissionStatus`: `DRAFT`, `READY_TO_SUBMIT`, `SUBMITTED`, `DECISIONED`, `FUNDED`, `CANCELED`
- `FinanceDecisionStatus`: `APPROVED`, `CONDITIONAL`, `DECLINED`, `PENDING`
- `FinanceFundingStatus`: `PENDING`, `FUNDED`, `CANCELED`
- `FinanceStipulationType`: `PAYSTUB`, `PROOF_RESIDENCE`, `INSURANCE`, `LICENSE`, `BANK_STATEMENT`, `OTHER`
- `FinanceStipulationStatus`: `REQUESTED`, `RECEIVED`, `WAIVED`
- `CreditApplicationStatus`: `DRAFT`, `READY_TO_SUBMIT`, `SUBMITTED`, `APPROVED`, `DENIED`, `CONDITIONALLY_APPROVED`, `WITHDRAWN`
- `LenderApplicationStatus`: `DRAFT`, `SUBMITTED`, `RECEIVED`, `APPROVED`, `DENIED`, `COUNTER_OFFER`, `STIP_PENDING`, `FUNDED`, `CANCELLED`
- `LenderStipulationStatusNew`: `REQUESTED`, `RECEIVED`, `APPROVED`, `REJECTED`, `WAIVED`
- `DealDocumentCategory`: `CONTRACT`, `ID`, `INSURANCE`, `STIPULATION`, `CREDIT`, `COMPLIANCE`, `OTHER`
- `ComplianceFormType`: `PRIVACY_NOTICE`, `ODOMETER_DISCLOSURE`, `BUYERS_GUIDE`, `ARBITRATION`, `OTHER`
- `ComplianceFormInstanceStatus`: `NOT_STARTED`, `GENERATED`, `REVIEWED`, `COMPLETED`

Constraints reflected in code:
- Contracted deals are treated as immutable for core financial mutations.
- Deal, finance, title, delivery, and funding workflows are modeled separately but linked.

### Accounting and expenses

Primary models:
- `AccountingAccount`
- `AccountingTransaction`
- `AccountingEntry`
- `DealershipExpense`
- `TaxProfile`

Important states and enums:
- `AccountingAccountType`: `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`
- `AccountingReferenceType`: `DEAL`, `VEHICLE`, `EXPENSE`, `MANUAL`, `OTHER`
- `AccountingEntryDirection`: `DEBIT`, `CREDIT`
- `DealershipExpenseStatus`: `OPEN`, `POSTED`, `VOID`

Current implementation note:
- Internal accounting ledgering is real.
- External accounting provider sync is not present.

### Intelligence and observability

Primary models:
- `IntelligenceSignal`
- `DealerRateLimitEvent`
- `DealerRateLimitStatsDaily`
- `DashboardLayoutPreference`
- `UserDealershipPreference`

Important enums:
- `IntelligenceSignalDomain`: `INVENTORY`, `CRM`, `DEALS`, `OPERATIONS`, `ACQUISITION`
- `IntelligenceSignalSeverity`: `INFO`, `SUCCESS`, `WARNING`, `DANGER`

## 2. Platform Database Overview

Platform schema size:
- 11 Prisma models

Primary models:
- `PlatformUser`
- `PlatformAccount`
- `Application`
- `PlatformDealership`
- `PlatformSubscription`
- `DealershipMapping`
- `PlatformAuditLog`
- `PlatformEmailLog`
- `PlatformInviteLog`
- `PlatformMonitoringEvent`
- `PlatformAlertState`

Important enums:
- `PlatformRole`: `PLATFORM_OWNER`, `PLATFORM_COMPLIANCE`, `PLATFORM_SUPPORT`
- `PlatformAccountStatus`: `ACTIVE`, `SUSPENDED`
- `ApplicationStatus`: `APPLIED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`
- `PlatformDealershipStatus`: `APPROVED`, `PROVISIONING`, `PROVISIONED`, `ACTIVE`, `SUSPENDED`, `CLOSED`
- `SubscriptionPlan`: `STARTER`, `PRO`, `ENTERPRISE`
- `BillingStatus`: `ACTIVE`, `TRIAL`, `PAST_DUE`, `CANCELLED`
- `PlatformEmailLogType`: `OWNER_INVITE`
- `PlatformMonitoringEventType`: `DEALER_HEALTH_FAIL`, `DEALER_HEALTH_RECOVER`
- `PlatformAlertStatus`: `OK`, `FAIL`

Ownership notes:
- `Application` represents the platform-side application review object, distinct from dealer-side `DealerApplication`.
- `PlatformDealership` is the control-plane tenant record.
- `DealershipMapping` links a platform dealership to the provisioned dealer-side dealership.
- `PlatformSubscription` is an internal record of plan and billing status, not proof of external billing automation.

## 3. Cross-Database Relationships

These relationships are operational, not Prisma-relational across a single schema:

Platform to dealer:
- `PlatformDealership.id` -> `DealershipMapping.platformDealershipId`
- `DealershipMapping.dealerDealershipId` -> dealer `Dealership.id`

Application pipeline:
- Dealer app stores `DealerApplication`
- Platform app stores `Application`
- Platform provisioning creates dealer tenant and writes mapping

Owner invite pipeline:
- Platform app orchestrates owner invites
- Dealer app creates and accepts dealership invites

## 4. Tenancy Boundaries in the Data Model

Dealer DB tenancy:
- Business-domain models are dealership-scoped in code and schema design.
- Query scope is derived from server-side tenant context, not caller-supplied IDs.

Platform DB tenancy:
- Platform database is not dealership-tenant-scoped in the same way as dealer data.
- It manages control-plane records spanning many dealer tenants.

Implication:
- Platform APIs can operate across dealerships because they are an operator/control-plane surface.
- Dealer APIs must derive and enforce a single active dealership context.

## 5. Important Constraints and Modeling Observations

Implemented constraints reflected in code/tests:
- Money amounts are modeled as integer cents/BigInt in dealer financial workflows.
- Many domains have explicit status enums and transition tests.
- Dealer-side audit and telemetry tables exist for operational introspection.
- Job-run telemetry exists both for dealer DB-backed jobs and platform monitoring projections.

Observed modeling drift:
- Permission catalog and seeded permissions contain some keys not used by current route handlers.
- Some enums imply broader external integrations than current service code actually implements.
- Worker/queue models exist beyond what current worker handlers fully execute.

## 6. Current Data Model Summary

The dealer DB is the product system of record:
- tenancy
- users/roles/permissions
- inventory and acquisitions
- customers and CRM
- deals and finance
- documents and compliance
- accounting
- onboarding
- intelligence and telemetry

The platform DB is the control-plane system of record:
- platform operators
- reviewed applications
- platform dealerships
- subscriptions
- platform audit/monitoring
- dealer tenant mapping
