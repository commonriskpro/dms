import * as React from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/api/endpoints";
import { VehicleHeaderCard } from "@/features/inventory/components/VehicleHeaderCard";
import { VehicleOverviewCard } from "@/features/inventory/components/VehicleOverviewCard";
import { VehiclePricingCard } from "@/features/inventory/components/VehiclePricingCard";
import { VehiclePhotoSection } from "@/features/inventory/components/VehiclePhotoSection";
import { VehicleReconSection } from "@/features/inventory/components/VehicleReconSection";

function safeId(param: string | string[] | undefined): string | undefined {
  if (param == null) return undefined;
  return Array.isArray(param) ? param[0] : param;
}

export default function VehicleDetailScreen() {
  const router = useRouter();
  const raw = useLocalSearchParams<{ id: string }>();
  const id = safeId(raw.id);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["inventory", id],
    queryFn: () => api.getInventoryById(id!),
    enabled: Boolean(id),
  });

  const { data: reconData, isLoading: reconLoading } = useQuery({
    queryKey: ["inventory", id, "recon"],
    queryFn: () => api.getVehicleRecon(id!),
    enabled: Boolean(id),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: ({ fileId }: { fileId: string }) => api.deleteVehiclePhoto(id!, fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", id] });
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async (uri: string, name: string, type: string) => {
      const formData = new FormData();
      formData.append("file", { uri, name, type } as any);
      return api.uploadVehiclePhoto(id!, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", id] });
    },
  });

  const handleAddPhoto = React.useCallback(async () => {
    Alert.alert("Add photo", "Choose source", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Take photo",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Permission needed", "Camera access is required to take a photo.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
          if (result.canceled || !result.assets[0]) return;
          const asset = result.assets[0];
          const name = asset.fileName ?? `photo-${Date.now()}.jpg`;
          const type = asset.mimeType ?? "image/jpeg";
          try {
            await uploadPhotoMutation.mutateAsync(asset.uri, name, type);
          } catch (e) {
            Alert.alert("Upload failed", e instanceof Error ? e.message : "Could not upload photo.");
          }
        },
      },
      {
        text: "Choose from library",
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
          if (result.canceled || !result.assets[0]) return;
          const asset = result.assets[0];
          const name = asset.fileName ?? `photo-${Date.now()}.jpg`;
          const type = asset.mimeType ?? "image/jpeg";
          try {
            await uploadPhotoMutation.mutateAsync(asset.uri, name, type);
          } catch (e) {
            Alert.alert("Upload failed", e instanceof Error ? e.message : "Could not upload photo.");
          }
        },
      },
    ]);
  }, [uploadPhotoMutation]);

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Invalid vehicle</Text>
      </View>
    );
  }

  if (isLoading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error instanceof Error ? error.message : "Something went wrong"}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const vehicle = data?.data;
  if (!vehicle) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Vehicle not found</Text>
      </View>
    );
  }

  const photos = vehicle.photos ?? [];
  const recon = reconData?.data ?? null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <VehicleHeaderCard
        vehicle={vehicle}
        onEdit={() => router.push(`/(tabs)/inventory/edit/${id}`)}
      />
      <VehicleOverviewCard vehicle={vehicle} />
      <VehiclePricingCard vehicle={vehicle} />
      <VehiclePhotoSection
        vehicle={vehicle}
        photos={photos}
        onAddPhoto={handleAddPhoto}
        onDeletePhoto={(fileId) => deletePhotoMutation.mutate({ fileId })}
        addPending={uploadPhotoMutation.isPending}
      />
      <VehicleReconSection recon={recon} isLoading={reconLoading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  muted: { color: "#666", fontSize: 14 },
  error: { color: "#c00", fontSize: 14 },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#208AEF",
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
