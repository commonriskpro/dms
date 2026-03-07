import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import type { DealDetail, CreateDealBody, UpdateDealBody } from "../types";
import { CustomerPickerField } from "./CustomerPickerField";
import { VehiclePickerField } from "./VehiclePickerField";
import { formatCentsToDollars, parseDollarsToCents, clampTaxRateBps } from "../utils";

const MIN_TOUCH = 48;

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  block: { marginBottom: 20 },
  label: { fontSize: 12, color: "#666", textTransform: "uppercase", marginBottom: 6 },
  input: {
    minHeight: MIN_TOUCH,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  saveBtn: {
    minHeight: MIN_TOUCH,
    backgroundColor: "#208AEF",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  error: { fontSize: 14, color: "#c00", marginTop: 8 },
});

export type DealFormValues = {
  customerId: string | null;
  customerName: string | null;
  vehicleId: string | null;
  vehicleSummary: string | null;
  salePriceDollars: string;
  purchasePriceDollars: string;
  taxRateBps: string;
  docFeeDollars: string;
  downPaymentDollars: string;
  notes: string;
};

const defaultValues: DealFormValues = {
  customerId: null,
  customerName: null,
  vehicleId: null,
  vehicleSummary: null,
  salePriceDollars: "",
  purchasePriceDollars: "",
  taxRateBps: "0",
  docFeeDollars: "0",
  downPaymentDollars: "0",
  notes: "",
};

function dealToFormValues(deal: DealDetail | null): DealFormValues {
  if (!deal) return defaultValues;
  return {
    customerId: deal.customerId,
    customerName: deal.customer?.name ?? null,
    vehicleId: deal.vehicleId,
    vehicleSummary: deal.vehicle
      ? [deal.vehicle.year, deal.vehicle.make, deal.vehicle.model].filter(Boolean).join(" ") + " · " + deal.vehicle.stockNumber
      : null,
    salePriceDollars: formatCentsToDollars(deal.salePriceCents),
    purchasePriceDollars: formatCentsToDollars(deal.purchasePriceCents),
    taxRateBps: String(deal.taxRateBps),
    docFeeDollars: formatCentsToDollars(deal.docFeeCents),
    downPaymentDollars: formatCentsToDollars(deal.downPaymentCents),
    notes: deal.notes ?? "",
  };
}

export function DealForm({
  mode,
  deal,
  onSubmit,
  isSubmitting,
  apiError,
}: {
  mode: "create" | "edit";
  deal: DealDetail | null;
  onSubmit: (payload: CreateDealBody | UpdateDealBody) => void;
  isSubmitting: boolean;
  apiError: string | null;
}) {
  const [values, setValues] = useState<DealFormValues>(() => dealToFormValues(deal));
  const isEdit = mode === "edit";

  useEffect(() => {
    setValues(dealToFormValues(deal));
  }, [deal?.id]);

  const update = (key: keyof DealFormValues, value: string | null) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    if (isEdit) {
      const body: UpdateDealBody = {
        salePriceCents: parseDollarsToCents(values.salePriceDollars) || undefined,
        taxRateBps: clampTaxRateBps(Number(values.taxRateBps) || 0),
        docFeeCents: parseDollarsToCents(values.docFeeDollars) || undefined,
        downPaymentCents: parseDollarsToCents(values.downPaymentDollars) || undefined,
        notes: values.notes.trim() || null,
      };
      onSubmit(body);
    } else {
      if (!values.customerId || !values.vehicleId) return;
      const saleCents = parseDollarsToCents(values.salePriceDollars);
      const purchaseCents = parseDollarsToCents(values.purchasePriceDollars);
      if (saleCents <= 0 || purchaseCents <= 0) return;
      const body: CreateDealBody = {
        customerId: values.customerId,
        vehicleId: values.vehicleId,
        salePriceCents: saleCents,
        purchasePriceCents: purchaseCents,
        taxRateBps: clampTaxRateBps(Number(values.taxRateBps) || 0),
        docFeeCents: parseDollarsToCents(values.docFeeDollars) || undefined,
        downPaymentCents: parseDollarsToCents(values.downPaymentDollars) || undefined,
        notes: values.notes.trim() || undefined,
      };
      onSubmit(body);
    }
  };

  const canSubmit =
    !isSubmitting &&
    (isEdit
      ? true
      : Boolean(values.customerId && values.vehicleId && parseDollarsToCents(values.salePriceDollars) > 0 && parseDollarsToCents(values.purchasePriceDollars) > 0));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!isEdit && (
          <>
            <View style={styles.block}>
              <CustomerPickerField
                customerId={values.customerId}
                customerName={values.customerName}
                onSelect={(id, name) => {
                  update("customerId", id);
                  update("customerName", name);
                }}
              />
            </View>
            <View style={styles.block}>
              <VehiclePickerField
                vehicleId={values.vehicleId}
                vehicleSummary={values.vehicleSummary}
                onSelect={(id, summary) => {
                  update("vehicleId", id);
                  update("vehicleSummary", summary);
                }}
              />
            </View>
          </>
        )}
        {isEdit && (values.customerName || values.vehicleSummary) && (
          <View style={styles.block}>
            <Text style={styles.label}>Customer / Vehicle (read-only)</Text>
            <Text style={{ fontSize: 14 }}>{values.customerName ?? "—"} · {values.vehicleSummary ?? "—"}</Text>
          </View>
        )}
        <View style={styles.block}>
          <Text style={styles.label}>Sale price ($)</Text>
          <TextInput
            style={styles.input}
            value={values.salePriceDollars}
            onChangeText={(t) => update("salePriceDollars", t.replace(/[^0-9.]/g, ""))}
            placeholder="0.00"
            keyboardType="decimal-pad"
            editable={!isSubmitting}
          />
        </View>
        {!isEdit && (
          <View style={styles.block}>
            <Text style={styles.label}>Purchase price ($)</Text>
            <TextInput
              style={styles.input}
              value={values.purchasePriceDollars}
              onChangeText={(t) => update("purchasePriceDollars", t.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              keyboardType="decimal-pad"
              editable={!isSubmitting}
            />
          </View>
        )}
        <View style={styles.block}>
          <Text style={styles.label}>Tax rate (bps, 0–10000)</Text>
          <TextInput
            style={styles.input}
            value={values.taxRateBps}
            onChangeText={(t) => update("taxRateBps", t.replace(/\D/g, "").slice(0, 5))}
            placeholder="0"
            keyboardType="number-pad"
            editable={!isSubmitting}
          />
        </View>
        <View style={styles.block}>
          <Text style={styles.label}>Doc fee ($)</Text>
          <TextInput
            style={styles.input}
            value={values.docFeeDollars}
            onChangeText={(t) => update("docFeeDollars", t.replace(/[^0-9.]/g, ""))}
            placeholder="0.00"
            keyboardType="decimal-pad"
            editable={!isSubmitting}
          />
        </View>
        <View style={styles.block}>
          <Text style={styles.label}>Down payment ($)</Text>
          <TextInput
            style={styles.input}
            value={values.downPaymentDollars}
            onChangeText={(t) => update("downPaymentDollars", t.replace(/[^0-9.]/g, ""))}
            placeholder="0.00"
            keyboardType="decimal-pad"
            editable={!isSubmitting}
          />
        </View>
        <View style={styles.block}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
            value={values.notes}
            onChangeText={(t) => update("notes", t.slice(0, 5000))}
            placeholder="Optional notes"
            multiline
            editable={!isSubmitting}
          />
        </View>
        {apiError ? <Text style={styles.error}>{apiError}</Text> : null}
        <TouchableOpacity
          style={[styles.saveBtn, !canSubmit && styles.saveBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveText}>{isEdit ? "Save changes" : "Create deal"}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
