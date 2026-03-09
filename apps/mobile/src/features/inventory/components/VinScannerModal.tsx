import * as React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { api } from "@/api/endpoints";
import type { VinDecodeVehicle } from "@/api/endpoints";
import { parseVinFromBarcode, isValidVin } from "../utils";

const MIN_TOUCH = 48;
const VIN_SCAN_DEBOUNCE_MS = 2500;

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
    minHeight: MIN_TOUCH,
  },
  error: { fontSize: 12, color: "#c00", marginBottom: 12 },
  row: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: "center", justifyContent: "center", minHeight: MIN_TOUCH },
  btnPrimary: { backgroundColor: "#208AEF" },
  btnSecondary: { backgroundColor: "#f0f0f0" },
  btnText: { fontSize: 16, fontWeight: "600" },
  btnTextPrimary: { color: "#fff" },
  btnTextSecondary: { color: "#333" },
  choiceBox: { backgroundColor: "#fff", borderRadius: 12, padding: 24 },
  choiceTitle: { fontSize: 18, fontWeight: "700", marginBottom: 20, textAlign: "center" },
  choiceBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, marginBottom: 10, minHeight: MIN_TOUCH, justifyContent: "center", backgroundColor: "#208AEF" },
  choiceBtnSecondary: { backgroundColor: "#f0f0f0" },
  choiceBtnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  choiceBtnTextSecondary: { color: "#333" },
  cameraWrap: { flex: 1, borderRadius: 12, overflow: "hidden", minHeight: 300 },
  camera: { flex: 1, minHeight: 280 },
  cameraFrame: { position: "absolute", left: 24, right: 24, top: "30%", height: 120, borderWidth: 2, borderColor: "#fff", borderRadius: 8 },
  cameraHint: { position: "absolute", bottom: 24, left: 24, right: 24, textAlign: "center", color: "#fff", fontSize: 14, backgroundColor: "rgba(0,0,0,0.5)", padding: 10, borderRadius: 8 },
  permissionDenied: { padding: 24, alignItems: "center" },
  permissionText: { fontSize: 14, color: "#333", textAlign: "center", marginBottom: 16 },
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
  const [view, setView] = React.useState<"choice" | "scan" | "manual">("choice");
  const [vin, setVin] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const lastScannedVinRef = React.useRef<{ vin: string; at: number } | null>(null);

  const [permission, requestPermission] = useCameraPermissions();

  React.useEffect(() => {
    if (visible) {
      setView("choice");
      setVin("");
      setError(null);
    }
  }, [visible]);

  const handleClose = () => {
    setVin("");
    setError(null);
    setView("choice");
    onClose();
  };

  const handleDecode = async (vinToDecode: string) => {
    const normalized = vinToDecode.replace(/\s/g, "").toUpperCase();
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
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decode failed");
    } finally {
      setLoading(false);
    }
  };

  const handleManualDecode = () => {
    handleDecode(vin);
  };

  const handleScanBarcode = () => {
    setView("scan");
    setError(null);
    if (permission?.granted) return;
    requestPermission().then((p) => {
      if (!p.granted) {
        setError("Camera access is needed to scan VIN. Use manual entry below.");
      }
    });
  };

  const handleBarcodeScanned = React.useCallback(
    (arg: { data: string } | { nativeEvent?: { data: string } }) => {
      const data = "data" in arg ? arg.data : arg.nativeEvent?.data;
      if (typeof data !== "string") return;
      const parsed = parseVinFromBarcode(data);
      if (parsed.length !== 17 || !isValidVin(parsed)) return;
      const now = Date.now();
      const last = lastScannedVinRef.current;
      if (last && last.vin === parsed && now - last.at < VIN_SCAN_DEBOUNCE_MS) return;
      lastScannedVinRef.current = { vin: parsed, at: now };
      setVin(parsed);
      setView("manual");
      setError(null);
      handleDecode(parsed);
    },
    []
  );

  const showManual = () => {
    setView("manual");
    setError(null);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        {view === "choice" && (
          <View style={styles.choiceBox}>
            <Text style={styles.choiceTitle}>VIN lookup</Text>
            <TouchableOpacity style={styles.choiceBtn} onPress={handleScanBarcode}>
              <Text style={styles.choiceBtnText}>Scan VIN barcode</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.choiceBtn, styles.choiceBtnSecondary]} onPress={showManual}>
              <Text style={[styles.choiceBtnText, styles.choiceBtnTextSecondary]}>Enter manually</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.choiceBtn, styles.choiceBtnSecondary]} onPress={handleClose}>
              <Text style={[styles.choiceBtnText, styles.choiceBtnTextSecondary]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {view === "scan" && (
          <View style={styles.box}>
            <Text style={styles.title}>Scan VIN</Text>
            {permission === null && (
              <View style={styles.permissionDenied}>
                <ActivityIndicator size="small" />
                <Text style={styles.permissionText}>Checking camera permission…</Text>
              </View>
            )}
            {permission !== null && !permission.granted && (
              <View style={styles.permissionDenied}>
                <Text style={styles.permissionText}>
                  Camera access is needed to scan VIN barcodes. You can enter the VIN manually instead.
                </Text>
                <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={showManual}>
                  <Text style={[styles.btnText, styles.btnTextPrimary]}>Enter manually</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleClose}>
                  <Text style={[styles.btnText, styles.btnTextSecondary]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
            {permission !== null && permission.granted && (
              <>
                <View style={styles.cameraWrap}>
                  <CameraView
                    style={styles.camera}
                    facing="back"
                    onBarcodeScanned={loading ? undefined : handleBarcodeScanned}
                    barcodeScannerSettings={{ barcodeTypes: ["code128", "code39", "code93", "codabar", "ean13", "ean8", "itf14", "upc_e", "pdf417", "qr"] }}
                  />
                  <View style={styles.cameraFrame} pointerEvents="none" />
                  <Text style={styles.cameraHint} pointerEvents="none">
                    Align the VIN barcode within the frame
                  </Text>
                </View>
                {error != null && <Text style={styles.error}>{error}</Text>}
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={showManual} disabled={loading}>
                    <Text style={[styles.btnText, styles.btnTextSecondary]}>Enter manually</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleClose} disabled={loading}>
                    <Text style={[styles.btnText, styles.btnTextSecondary]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        {view === "manual" && (
          <View style={styles.box}>
            <Text style={styles.title}>VIN lookup</Text>
            <TextInput
              style={styles.input}
              value={vin}
              onChangeText={(t) => {
                setVin(t.toUpperCase());
                setError(null);
              }}
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
                onPress={handleManualDecode}
                disabled={loading || vin.replace(/\s/g, "").length !== 17}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.btnText, styles.btnTextPrimary]}>Decode</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
