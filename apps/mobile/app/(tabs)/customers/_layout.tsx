import { Stack } from "expo-router";

export default function CustomersLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ title: "Customers" }} />
      <Stack.Screen name="add" options={{ title: "Add customer" }} />
      <Stack.Screen name="[id]" options={{ title: "Customer" }} />
      <Stack.Screen name="edit" options={{ title: "Edit customer", headerShown: false }} />
    </Stack>
  );
}
