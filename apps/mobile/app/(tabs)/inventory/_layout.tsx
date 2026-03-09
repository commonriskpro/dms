import { Stack } from "expo-router";

export default function InventoryLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ title: "Inventory" }} />
      <Stack.Screen name="add" options={{ title: "Add vehicle" }} />
      <Stack.Screen name="[id]" options={{ title: "Vehicle" }} />
      <Stack.Screen name="edit" options={{ title: "Edit vehicle", headerShown: false }} />
    </Stack>
  );
}
