import { z } from "zod";

export const complianceFormTypeSchema = z.enum([
  "PRIVACY_NOTICE",
  "ODOMETER_DISCLOSURE",
  "BUYERS_GUIDE",
  "ARBITRATION",
  "OTHER",
]);

export const complianceFormInstanceStatusSchema = z.enum([
  "NOT_STARTED",
  "GENERATED",
  "REVIEWED",
  "COMPLETED",
]);

export const listComplianceFormsQuerySchema = z.object({
  dealId: z.string().uuid(),
});

export const generateComplianceFormBodySchema = z.object({
  dealId: z.string().uuid(),
  formType: complianceFormTypeSchema,
}).strict();

export const updateComplianceFormBodySchema = z.object({
  status: complianceFormInstanceStatusSchema,
  completedAt: z.string().datetime().optional().nullable(),
}).strict();

export const listComplianceAlertsQuerySchema = z.object({
  dealId: z.string().uuid().optional(),
});
