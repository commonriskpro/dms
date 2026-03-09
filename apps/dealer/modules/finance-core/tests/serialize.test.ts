/**
 * Serializers: SSN never exposed; only ssnMasked (***-**-****).
 */
import {
  serializeCreditApplication,
  serializeCreditApplicationListItem,
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
});
