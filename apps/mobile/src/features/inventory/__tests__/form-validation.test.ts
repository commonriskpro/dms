import { validateVehicleForm } from "../form-validation";

const baseValues = {
  vin: "",
  year: "",
  make: "",
  model: "",
  trim: "",
  stockNumber: "",
  mileage: "",
  priceDollars: "",
  color: "",
  status: "AVAILABLE",
};

describe("inventory/form-validation", () => {
  it("requires stock number", () => {
    expect(validateVehicleForm({ ...baseValues, stockNumber: "" }).stockNumber).toBe("Stock number is required");
    expect(validateVehicleForm({ ...baseValues, stockNumber: "S123" }).stockNumber).toBeUndefined();
  });

  it("validates VIN when provided", () => {
    expect(validateVehicleForm({ ...baseValues, vin: "short" }).vin).toBe("VIN must be 17 characters");
    expect(validateVehicleForm({ ...baseValues, vin: "1HGBH41JXMN109186" }).vin).toBeUndefined();
  });

  it("validates year when provided", () => {
    expect(validateVehicleForm({ ...baseValues, year: "abc" }).year).toBe("Enter a valid year");
    expect(validateVehicleForm({ ...baseValues, year: "2024" }).year).toBeUndefined();
  });

  it("validates mileage when provided", () => {
    expect(validateVehicleForm({ ...baseValues, mileage: "-1" }).mileage).toBe("Enter a valid mileage");
    expect(validateVehicleForm({ ...baseValues, mileage: "10000" }).mileage).toBeUndefined();
  });

  it("validates price when provided", () => {
    expect(validateVehicleForm({ ...baseValues, priceDollars: "x" }).priceDollars).toBe("Enter a valid price");
    expect(validateVehicleForm({ ...baseValues, priceDollars: "25000" }).priceDollars).toBeUndefined();
  });
});
