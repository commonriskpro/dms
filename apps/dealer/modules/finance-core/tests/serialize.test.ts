/**
 * Serializers: SSN never exposed; only ssnMasked (***-**-****).
 */
import {
  serializeCreditApplication,
  serializeCreditApplicationListItem,
  serializeComplianceForm,
  serializeDealDocument,
} from "../serialize";

describe("finance-core serialize", () => {
  describe("serializeCreditApplication", () => {
    it("exposes ssnMasked as ***-**-**** when ssnEncrypted is present", () => {
      const row = {
        id: "id1",
        dealId: null,
        customerId: "c1",
        status: "DRAFT",
        applicantFirstName: "Jane",
        applicantLastName: "Doe",
        dob: null,
        ssnEncrypted: "encrypted-blob",
        phone: null,
        email: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        state: null,
        postalCode: null,
        housingStatus: null,
        housingPaymentCents: null,
        yearsAtResidence: null,
        employerName: null,
        jobTitle: null,
        employmentYears: null,
        monthlyIncomeCents: null,
        otherIncomeCents: null,
        notes: null,
        submittedAt: null,
        decisionedAt: null,
        createdByUserId: null,
        updatedByUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const out = serializeCreditApplication(row);
      expect(out.ssnMasked).toBe("***-**-****");
      expect((out as Record<string, unknown>).ssnEncrypted).toBeUndefined();
      expect((out as Record<string, unknown>).ssn).toBeUndefined();
    });

    it("exposes ssnMasked as null when ssnEncrypted is null", () => {
      const row = {
        id: "id1",
        dealId: null,
        customerId: "c1",
        status: "DRAFT",
        applicantFirstName: "Jane",
        applicantLastName: "Doe",
        dob: null,
        ssnEncrypted: null,
        phone: null,
        email: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        state: null,
        postalCode: null,
        housingStatus: null,
        housingPaymentCents: null,
        yearsAtResidence: null,
        employerName: null,
        jobTitle: null,
        employmentYears: null,
        monthlyIncomeCents: null,
        otherIncomeCents: null,
        notes: null,
        submittedAt: null,
        decisionedAt: null,
        createdByUserId: null,
        updatedByUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const out = serializeCreditApplication(row);
      expect(out.ssnMasked).toBeNull();
    });
  });

  describe("serializeCreditApplicationListItem", () => {
    it("does not include SSN or ssnEncrypted (list items have no SSN field)", () => {
      const row = {
        id: "id1",
        dealId: null,
        customerId: "c1",
        status: "DRAFT",
        applicantFirstName: "Jane",
        applicantLastName: "Doe",
        submittedAt: null,
        decisionedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const out = serializeCreditApplicationListItem(row);
      expect((out as Record<string, unknown>).ssn).toBeUndefined();
      expect((out as Record<string, unknown>).ssnEncrypted).toBeUndefined();
      expect((out as Record<string, unknown>).ssnMasked).toBeUndefined();
    });
  });

  describe("serializeComplianceForm", () => {
    it("normalizes generatedPayloadJson to object-or-null and serializes dates", () => {
      const now = new Date("2026-03-10T12:00:00.000Z");
      const out = serializeComplianceForm({
        id: "f1",
        dealId: "d1",
        formType: "ODOMETER",
        status: "GENERATED",
        generatedPayloadJson: { section: "value" },
        generatedAt: now,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      expect(out.generatedPayloadJson).toEqual({ section: "value" });
      expect(out.generatedAt).toBe("2026-03-10T12:00:00.000Z");
      expect(out.completedAt).toBeNull();
      expect(out.createdAt).toBe("2026-03-10T12:00:00.000Z");
      expect(out.updatedAt).toBe("2026-03-10T12:00:00.000Z");
    });

    it("forces non-object payloads to null", () => {
      const now = new Date("2026-03-10T12:00:00.000Z");
      const listPayload = serializeComplianceForm({
        id: "f1",
        dealId: "d1",
        formType: "ODOMETER",
        status: "GENERATED",
        generatedPayloadJson: ["x"],
        generatedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      const scalarPayload = serializeComplianceForm({
        id: "f2",
        dealId: "d2",
        formType: "ODOMETER",
        status: "GENERATED",
        generatedPayloadJson: 123,
        generatedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      expect(listPayload.generatedPayloadJson).toBeNull();
      expect(scalarPayload.generatedPayloadJson).toBeNull();
    });
  });

  describe("serializeDealDocument", () => {
    it("serializes document fields with ISO timestamps", () => {
      const now = new Date("2026-03-10T12:00:00.000Z");
      const out = serializeDealDocument({
        id: "doc1",
        dealId: "deal1",
        creditApplicationId: "ca1",
        lenderApplicationId: null,
        category: "CREDIT",
        title: "Credit App",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        uploadedByUserId: "user1",
        createdAt: now,
        updatedAt: now,
      });

      expect(out).toEqual({
        id: "doc1",
        dealId: "deal1",
        creditApplicationId: "ca1",
        lenderApplicationId: null,
        category: "CREDIT",
        title: "Credit App",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        uploadedByUserId: "user1",
        createdAt: "2026-03-10T12:00:00.000Z",
        updatedAt: "2026-03-10T12:00:00.000Z",
      });
    });
  });
});
