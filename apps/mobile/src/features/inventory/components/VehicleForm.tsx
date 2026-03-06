import * as React from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import type { VehicleDetail, CreateVehicleBody } from "@/api/endpoints";
import type { VehicleFormValues } from "../form-validation";
import { validateVehicleForm, statusOptions } from "../form-validation";

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 32 },
  row: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 },
  required: { color: "#c00" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    minHeight: 48,
  },
  error: { fontSize: 12, color: "#c00", marginTop: 4 },
  submit: {
    backgroundColor: "#208AEF",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  apiError: { fontSize: 14, color: "#c00", marginBottom: 12 },
  scanBtn: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: "#f0f0f0", borderRadius: 8, alignSelf: "flex-start" },
  scanBtnText: { fontSize: 15, fontWeight: "600", color: "#333" },
});

const defaultValues: VehicleFormValues = {
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

function toBody(values: VehicleFormValues): CreateVehicleBody {
  const body: CreateVehicleBody = {
    stockNumber: values.stockNumber.trim(),
    status: values.status.trim() || undefined,
  };
  const vin = values.vin.trim().replace(/\s/g, "").toUpperCase();
  if (vin) body.vin = vin;
  if (values.year.trim()) {
    const y = parseInt(values.year, 10);
    if (!Number.isNaN(y)) body.year = y;
  }
  if (values.make.trim()) body.make = values.make.trim();
  if (values.model.trim()) body.model = values.model.trim();
  if (values.trim.trim()) body.trim = values.trim.trim();
  if (values.mileage.trim()) {
    const m = parseInt(values.mileage, 10);
    if (!Number.isNaN(m) && m >= 0) body.mileage = m;
  }
  if (values.priceDollars.trim()) {
    const dollars = parseFloat(values.priceDollars);
    if (!Number.isNaN(dollars) && dollars >= 0) body.salePriceCents = String(Math.round(dollars * 100));
  }
  if (values.color.trim()) body.color = values.color.trim();
  return body;
}

export type VinDecodedResult = { vin: string; vehicle: { year?: string; make?: string; model?: string; trim?: string } };

export function VehicleForm({
  mode,
  initialVehicle,
  onSubmit,
  submitLabel = "Save",
  onScanVin,
  applyDecoded,
}: {
  mode: "create" | "edit";
  initialVehicle?: VehicleDetail | null;
  onSubmit: (body: CreateVehicleBody) => Promise<void>;
  submitLabel?: string;
  onScanVin?: () => void;
  applyDecoded?: VinDecodedResult | null;
}) {
  const [values, setValues] = React.useState<VehicleFormValues>(() => {
    if (initialVehicle && mode === "edit") {
      const salePrice = initialVehicle.salePriceCents
        ? (typeof initialVehicle.salePriceCents === "string"
            ? parseInt(initialVehicle.salePriceCents, 10)
            : initialVehicle.salePriceCents) / 100
        : "";
      return {
        vin: initialVehicle.vin ?? "",
        year: initialVehicle.year != null ? String(initialVehicle.year) : "",
        make: initialVehicle.make ?? "",
        model: initialVehicle.model ?? "",
        trim: initialVehicle.trim ?? "",
        stockNumber: initialVehicle.stockNumber ?? "",
        mileage: initialVehicle.mileage != null ? String(initialVehicle.mileage) : "",
        priceDollars: salePrice !== "" ? String(salePrice) : "",
        color: initialVehicle.color ?? "",
        status: initialVehicle.status ?? "AVAILABLE",
      };
    }
    return defaultValues;
  });
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [pending, setPending] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (applyDecoded) {
      setValues((v) => ({
        ...v,
        vin: applyDecoded.vin,
        year: applyDecoded.vehicle?.year ?? v.year,
        make: applyDecoded.vehicle?.make ?? v.make,
        model: applyDecoded.vehicle?.model ?? v.model,
        trim: applyDecoded.vehicle?.trim ?? v.trim,
      }));
    }
  }, [applyDecoded?.vin, applyDecoded?.vehicle?.year, applyDecoded?.vehicle?.make, applyDecoded?.vehicle?.model, applyDecoded?.vehicle?.trim]);

  const errors = validateVehicleForm(values);

  const handleSubmit = async () => {
    setApiError(null);
    const err = validateVehicleForm(values);
    if (Object.keys(err).length > 0) {
      setTouched({ stockNumber: true, vin: true, year: true, mileage: true, priceDollars: true });
      return;
    }
    setPending(true);
    try {
      await onSubmit(toBody(values));
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView style={styles.wrap} keyboardShouldPersistTaps="handled">
        {apiError != null && <Text style={styles.apiError}>{apiError}</Text>}
        {onScanVin && (
          <View style={styles.row}>
            <TouchableOpacity style={styles.scanBtn} onPress={onScanVin}>
              <Text style={styles.scanBtnText}>Scan VIN</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>VIN</Text>
          <TextInput
            style={styles.input}
            value={values.vin}
            onChangeText={(t) => setValues((v) => ({ ...v, vin: t.toUpperCase() }))}
            onBlur={() => setTouched((t) => ({ ...t, vin: true }))}
            placeholder="17 characters"
            placeholderTextColor="#999"
            maxLength={17}
            editable={!pending}
          />
          {touched.vin && errors.vin != null && <Text style={styles.error}>{errors.vin}</Text>}
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Stock # <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={values.stockNumber}
            onChangeText={(t) => setValues((v) => ({ ...v, stockNumber: t }))}
            onBlur={() => setTouched((t) => ({ ...t, stockNumber: true }))}
            placeholder="Stock number"
            placeholderTextColor="#999"
            editable={!pending}
          />
          {touched.stockNumber && errors.stockNumber != null && <Text style={styles.error}>{errors.stockNumber}</Text>}
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Year</Text>
          <TextInput
            style={styles.input}
            value={values.year}
            onChangeText={(t) => setValues((v) => ({ ...v, year: t }))}
            onBlur={() => setTouched((t) => ({ ...t, year: true }))}
            placeholder="e.g. 2024"
            placeholderTextColor="#999"
            keyboardType="number-pad"
            editable={!pending}
          />
          {touched.year && errors.year != null && <Text style={styles.error}>{errors.year}</Text>}
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Make</Text>
          <TextInput
            style={styles.input}
            value={values.make}
            onChangeText={(t) => setValues((v) => ({ ...v, make: t }))}
            placeholder="Make"
            placeholderTextColor="#999"
            editable={!pending}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Model</Text>
          <TextInput
            style={styles.input}
            value={values.model}
            onChangeText={(t) => setValues((v) => ({ ...v, model: t }))}
            placeholder="Model"
            placeholderTextColor="#999"
            editable={!pending}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Trim</Text>
          <TextInput
            style={styles.input}
            value={values.trim}
            onChangeText={(t) => setValues((v) => ({ ...v, trim: t }))}
            placeholder="Trim"
            placeholderTextColor="#999"
            editable={!pending}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Mileage</Text>
          <TextInput
            style={styles.input}
            value={values.mileage}
            onChangeText={(t) => setValues((v) => ({ ...v, mileage: t }))}
            onBlur={() => setTouched((t) => ({ ...t, mileage: true }))}
            placeholder="Miles"
            placeholderTextColor="#999"
            keyboardType="number-pad"
            editable={!pending}
          />
          {touched.mileage && errors.mileage != null && <Text style={styles.error}>{errors.mileage}</Text>}
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Price (USD)</Text>
          <TextInput
            style={styles.input}
            value={values.priceDollars}
            onChangeText={(t) => setValues((v) => ({ ...v, priceDollars: t }))}
            onBlur={() => setTouched((t) => ({ ...t, priceDollars: true }))}
            placeholder="e.g. 25000"
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
            editable={!pending}
          />
          {touched.priceDollars && errors.priceDollars != null && <Text style={styles.error}>{errors.priceDollars}</Text>}
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Color</Text>
          <TextInput
            style={styles.input}
            value={values.color}
            onChangeText={(t) => setValues((v) => ({ ...v, color: t }))}
            placeholder="Color"
            placeholderTextColor="#999"
            editable={!pending}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <TextInput
            style={styles.input}
            value={values.status}
            onChangeText={(t) => setValues((v) => ({ ...v, status: t }))}
            placeholder="AVAILABLE, HOLD, SOLD, etc."
            placeholderTextColor="#999"
            editable={!pending}
          />
        </View>
        <TouchableOpacity
          style={[styles.submit, pending && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={pending}
        >
          {pending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitText}>{submitLabel}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
