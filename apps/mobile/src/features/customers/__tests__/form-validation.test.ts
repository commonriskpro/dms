import { validateCustomerForm } from "../form-validation";

describe("customers/form-validation", () => {
  it("requires name", () => {
    expect(validateCustomerForm({ ...baseValues, name: "" }).name).toBe("Name is required");
    expect(validateCustomerForm({ ...baseValues, name: "  " }).name).toBe("Name is required");
    expect(validateCustomerForm({ ...baseValues, name: "John" }).name).toBeUndefined();
  });

  it("validates email when provided", () => {
    expect(validateCustomerForm({ ...baseValues, email: "bad" }).email).toBe("Enter a valid email");
    expect(validateCustomerForm({ ...baseValues, email: "a@b.com" }).email).toBeUndefined();
    expect(validateCustomerForm({ ...baseValues, email: "" }).email).toBeUndefined();
  });

  it("returns empty when valid", () => {
    expect(validateCustomerForm({ ...baseValues, name: "Jane", email: "j@x.co" })).toEqual({});
  });
});

const baseValues = {
  name: "Test",
  phone: "",
  email: "",
  leadSource: "",
  status: "LEAD",
  initialNote: "",
};
