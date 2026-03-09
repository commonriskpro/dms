import * as React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  ScrollView,
  Alert,
} from "react-native";
import { api } from "@/api/endpoints";
import type { VehicleDetail, VehiclePhoto } from "@/api/endpoints";

const styles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  title: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 12, textTransform: "uppercase" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    width: "31%",
    aspectRatio: 1,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cardText: { fontSize: 11, color: "#666", textAlign: "center", padding: 4 },
  addBtn: {
    width: "31%",
    aspectRatio: 1,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#ccc",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnText: { fontSize: 12, color: "#666" },
  empty: { padding: 20, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#666" },
  modal: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center" },
  modalClose: { position: "absolute", top: 50, right: 16, zIndex: 1, padding: 12, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 8 },
  modalCloseText: { color: "#fff", fontSize: 16 },
  modalImage: { width: "100%", aspectRatio: 1 },
  deleteBtn: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#dc3545", borderRadius: 8 },
  deleteBtnText: { color: "#fff", fontSize: 12 },
});

export function VehiclePhotoSection({
  vehicle,
  photos,
  onAddPhoto,
  onDeletePhoto,
  addPending,
}: {
  vehicle: VehicleDetail;
  photos: VehiclePhoto[];
  onAddPhoto: () => void;
  onDeletePhoto: (fileId: string) => void;
  addPending?: boolean;
}) {
  const [previewUri, setPreviewUri] = React.useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = React.useState<VehiclePhoto | null>(null);
  const [loadingUrl, setLoadingUrl] = React.useState(false);

  const handleTapPhoto = async (photo: VehiclePhoto) => {
    setPreviewPhoto(photo);
    setLoadingUrl(true);
    setPreviewUri(null);
    try {
      const { url } = await api.getFileSignedUrl(photo.fileObjectId);
      setPreviewUri(url);
    } catch {
      setPreviewUri(null);
    } finally {
      setLoadingUrl(false);
    }
  };

  const handleClosePreview = () => {
    setPreviewUri(null);
    setPreviewPhoto(null);
  };

  const handleDeleteInPreview = () => {
    if (!previewPhoto) return;
    Alert.alert(
      "Delete photo",
      "Remove this photo from the vehicle?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDeletePhoto(previewPhoto.fileObjectId);
            handleClosePreview();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Photos</Text>
      {photos.length === 0 && !addPending ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No photos yet</Text>
          <TouchableOpacity style={[styles.addBtn, { marginTop: 12 }]} onPress={onAddPhoto}>
            <Text style={styles.addBtnText}>Add photo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.grid}>
          {photos.map((photo) => (
            <TouchableOpacity
              key={photo.id}
              style={styles.card}
              onPress={() => handleTapPhoto(photo)}
              activeOpacity={0.8}
            >
              <Text style={styles.cardText} numberOfLines={2}>{photo.filename || "Photo"}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.addBtn}
            onPress={onAddPhoto}
            disabled={addPending}
          >
            {addPending ? <ActivityIndicator size="small" /> : <Text style={styles.addBtnText}>+ Add</Text>}
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={previewPhoto != null} transparent animationType="fade">
        <View style={styles.modal}>
          <TouchableOpacity style={styles.modalClose} onPress={handleClosePreview}>
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
          {loadingUrl ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : previewUri ? (
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
              <Image source={{ uri: previewUri }} style={styles.modalImage} resizeMode="contain" />
              <View style={{ padding: 16, alignItems: "center" }}>
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteInPreview}>
                  <Text style={styles.deleteBtnText}>Delete photo</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <Text style={{ color: "#fff", textAlign: "center" }}>Could not load image</Text>
          )}
        </View>
      </Modal>
    </View>
  );
}
