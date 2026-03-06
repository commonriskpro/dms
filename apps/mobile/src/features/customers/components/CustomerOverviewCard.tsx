import { View, Text, StyleSheet } from "react-native";
import type { CustomerDetail } from "@/api/endpoints";
import { getPrimaryPhone, getPrimaryEmail } from "../utils";

const card = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  label: { fontSize: 12, color: "#666", marginBottom: 4, textTransform: "uppercase" },
  value: { fontSize: 16, fontWeight: "500" },
  row: { marginBottom: 12 },
  rowLast: { marginBottom: 0 },
});

export function CustomerOverviewCard({ customer }: { customer: CustomerDetail }) {
  const phone = getPrimaryPhone(customer);
  const email = getPrimaryEmail(customer);
  const assigned = customer.assignedToProfile?.fullName ?? customer.assignedToProfile?.email ?? null;

  return (
    <View style={card.wrap}>
      <Text style={card.label}>Overview</Text>
      <View style={card.row}>
        <Text style={card.label}>Phone</Text>
        <Text style={card.value}>{phone ?? "—"}</Text>
      </View>
      <View style={card.row}>
        <Text style={card.label}>Email</Text>
        <Text style={card.value}>{email ?? "—"}</Text>
      </View>
      {customer.leadSource != null && customer.leadSource !== "" && (
        <View style={card.row}>
          <Text style={card.label}>Source</Text>
          <Text style={card.value}>{customer.leadSource}</Text>
        </View>
      )}
      <View style={card.row}>
        <Text style={card.label}>Status</Text>
        <Text style={card.value}>{customer.status ?? "—"}</Text>
      </View>
      {assigned && (
        <View style={card.row}>
          <Text style={card.label}>Assigned to</Text>
          <Text style={card.value}>{assigned}</Text>
        </View>
      )}
      <View style={[card.row, card.rowLast]}>
        <Text style={card.label}>Updated</Text>
        <Text style={card.value}>
          {customer.updatedAt ? new Date(customer.updatedAt).toLocaleDateString() : "—"}
        </Text>
      </View>
    </View>
  );
}
