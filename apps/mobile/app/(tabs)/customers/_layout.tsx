import { Stack } from "expo-router";

export default function CustomersLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ title: "Customers" }} />
      <Stack.Screen name="[id]" options={{ title: "Customer" }} />
    </Stack>
  );
}
