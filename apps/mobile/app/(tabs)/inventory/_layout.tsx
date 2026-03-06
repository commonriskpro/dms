import { Stack } from "expo-router";

export default function InventoryLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ title: "Inventory" }} />
      <Stack.Screen name="[id]" options={{ title: "Vehicle" }} />
    </Stack>
  );
}
