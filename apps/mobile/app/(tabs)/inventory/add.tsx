import * as React from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/endpoints";
import { VehicleForm } from "@/features/inventory/components/VehicleForm";
import { VinScannerModal } from "@/features/inventory/components/VinScannerModal";
import type { VinDecodedResult } from "@/features/inventory/components/VehicleForm";

export default function AddVehicleScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showVinModal, setShowVinModal] = React.useState(false);
  const [decoded, setDecoded] = React.useState<VinDecodedResult | null>(null);

  const handleSubmit = async (body: Parameters<Parameters<typeof VehicleForm>[0]["onSubmit"]>[0]) => {
    const { data } = await api.createVehicle(body);
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    router.replace(`/(tabs)/inventory/${data.id}`);
  };

  const handleVinResult = (result: { vin: string; vehicle: VinDecodedResult["vehicle"] }) => {
    setDecoded({ vin: result.vin, vehicle: result.vehicle });
  };

  return (
    <>
      <VehicleForm
        mode="create"
        onSubmit={handleSubmit}
        submitLabel="Add vehicle"
        onScanVin={() => setShowVinModal(true)}
        applyDecoded={decoded}
      />
      <VinScannerModal
        visible={showVinModal}
        onClose={() => setShowVinModal(false)}
        onResult={handleVinResult}
      />
    </>
  );
}
