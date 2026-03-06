import * as React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { api } from "@/api/endpoints";
import type { VinDecodeVehicle } from "@/api/endpoints";
import { parseVinFromBarcode, isValidVin } from "../utils";

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  box: { backgroundColor: "#fff", borderRadius: 12, padding: 20 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  error: { fontSize: 12, color: "#c00", marginBottom: 12 },
  row: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  btnPrimary: { backgroundColor: "#208AEF" },
  btnSecondary: { backgroundColor: "#f0f0f0" },
  btnText: { fontSize: 16, fontWeight: "600" },
  btnTextPrimary: { color: "#fff" },
  btnTextSecondary: { color: "#333" },
});

export type VinDecodedResult = { vin: string; vehicle: VinDecodeVehicle };

export function VinScannerModal({
  visible,
  onClose,
  onResult,
}: {
  visible: boolean;
  onClose: () => void;
  onResult: (result: VinDecodedResult) => void;
}) {
  const [vin, setVin] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleDecode = async () => {
    const normalized = vin.replace(/\s/g, "").toUpperCase();
    if (normalized.length !== 17) {
      setError("VIN must be 17 characters");
      return;
    }
    if (!isValidVin(normalized)) {
      setError("Invalid VIN characters");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.decodeVin(normalized);
      const vehicle = res.data?.vehicle ?? {};
      onResult({ vin: normalized, vehicle });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decode failed");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setVin("");
    setError(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>VIN lookup</Text>
          <TextInput
            style={styles.input}
            value={vin}
            onChangeText={(t) => { setVin(t.toUpperCase()); setError(null); }}
            placeholder="Enter 17-character VIN"
            placeholderTextColor="#999"
            maxLength={17}
            autoCapitalize="characters"
            editable={!loading}
          />
          {error != null && <Text style={styles.error}>{error}</Text>}
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleClose} disabled={loading}>
              <Text style={[styles.btnText, styles.btnTextSecondary]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={handleDecode}
              disabled={loading || vin.replace(/\s/g, "").length !== 17}
            >
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[styles.btnText, styles.btnTextPrimary]}>Decode</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
