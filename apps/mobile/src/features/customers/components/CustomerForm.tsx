import * as React from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import type { CustomerDetail, CreateCustomerBody } from "@/api/endpoints";
import type { CustomerFormValues } from "../form-validation";
import { validateCustomerForm } from "../form-validation";

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
  inputMultiline: { minHeight: 88, textAlignVertical: "top" },
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
});

const defaultValues: CustomerFormValues = {
  name: "",
  phone: "",
  email: "",
  leadSource: "",
  status: "LEAD",
  initialNote: "",
};

function toBody(values: CustomerFormValues, mode: "create" | "edit"): CreateCustomerBody {
  const body: CreateCustomerBody = {
    name: values.name.trim(),
  };
  if (values.leadSource.trim()) body.leadSource = values.leadSource.trim();
  if (values.status.trim()) body.status = values.status.trim();
  if (values.phone.trim()) {
    body.phones = [{ value: values.phone.trim(), isPrimary: true }];
  }
  if (values.email.trim()) {
    body.emails = [{ value: values.email.trim(), isPrimary: true }];
  }
  return body;
}

export function CustomerForm({
  mode,
  initialCustomer,
  onSubmit,
  submitLabel = "Save",
  showInitialNote = false,
}: {
  mode: "create" | "edit";
  initialCustomer?: CustomerDetail | null;
  onSubmit: (body: CreateCustomerBody, initialNote?: string) => Promise<void>;
  submitLabel?: string;
  showInitialNote?: boolean;
}) {
  const [values, setValues] = React.useState<CustomerFormValues>(() => {
    if (initialCustomer && mode === "edit") {
      const phone = initialCustomer.phones?.find((p) => p.isPrimary) ?? initialCustomer.phones?.[0];
      const email = initialCustomer.emails?.find((e) => e.isPrimary) ?? initialCustomer.emails?.[0];
      return {
        name: initialCustomer.name ?? "",
        phone: phone?.value ?? "",
        email: email?.value ?? "",
        leadSource: initialCustomer.leadSource ?? "",
        status: initialCustomer.status ?? "LEAD",
        initialNote: "",
      };
    }
    return defaultValues;
  });
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [pending, setPending] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  const errors = validateCustomerForm(values);

  const handleSubmit = async () => {
    setApiError(null);
    const err = validateCustomerForm(values);
    if (err.name || err.email) {
      setTouched({ name: true, email: true });
      return;
    }
    setPending(true);
    try {
      const body = toBody(values, mode);
      const initialNote = showInitialNote && mode === "create" ? values.initialNote.trim() || undefined : undefined;
      await onSubmit(body, initialNote);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView style={styles.wrap} keyboardShouldPersistTaps="handled">
        {apiError != null && <Text style={styles.apiError}>{apiError}</Text>}
        <View style={styles.row}>
          <Text style={styles.label}>Name <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={values.name}
            onChangeText={(t) => setValues((v) => ({ ...v, name: t }))}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            placeholder="Full name"
            placeholderTextColor="#999"
            editable={!pending}
          />
          {touched.name && errors.name != null && <Text style={styles.error}>{errors.name}</Text>}
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={values.phone}
            onChangeText={(t) => setValues((v) => ({ ...v, phone: t }))}
            placeholder="Phone"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
            editable={!pending}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={values.email}
            onChangeText={(t) => setValues((v) => ({ ...v, email: t }))}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            placeholder="Email"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!pending}
          />
          {touched.email && errors.email != null && <Text style={styles.error}>{errors.email}</Text>}
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Source</Text>
          <TextInput
            style={styles.input}
            value={values.leadSource}
            onChangeText={(t) => setValues((v) => ({ ...v, leadSource: t }))}
            placeholder="Lead source"
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
            placeholder="LEAD, ACTIVE, SOLD, INACTIVE"
            placeholderTextColor="#999"
            editable={!pending}
          />
        </View>
        {showInitialNote && mode === "create" && (
          <View style={styles.row}>
            <Text style={styles.label}>Initial note (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={values.initialNote}
              onChangeText={(t) => setValues((v) => ({ ...v, initialNote: t }))}
              placeholder="Add a note…"
              placeholderTextColor="#999"
              multiline
              editable={!pending}
            />
          </View>
        )}
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
