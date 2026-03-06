import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { VehicleDetail } from "@/api/endpoints";
import { vehicleTitle } from "../utils";

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#111", marginBottom: 8 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    fontSize: 12,
    color: "#666",
    backgroundColor: "#f0f0f0",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  actions: { flexDirection: "row", gap: 10 },
  actionBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#208AEF" },
  actionText: { fontSize: 15, fontWeight: "600", color: "#fff" },
});

export function VehicleHeaderCard({
  vehicle,
  onEdit,
}: {
  vehicle: VehicleDetail;
  onEdit: () => void;
}) {
  const title = vehicleTitle(vehicle);
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title || vehicle.stockNumber || "Vehicle"}</Text>
      <View style={styles.meta}>
        {vehicle.vin != null && vehicle.vin !== "" && <Text style={styles.chip}>{vehicle.vin}</Text>}
        <Text style={styles.chip}>{vehicle.stockNumber}</Text>
        <Text style={styles.chip}>{vehicle.status}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onEdit}>
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
