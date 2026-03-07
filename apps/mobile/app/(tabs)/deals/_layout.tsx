import { Stack } from "expo-router";

export default function DealsLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ title: "Deals" }} />
      <Stack.Screen name="add" options={{ title: "New deal" }} />
      <Stack.Screen name="[id]" options={{ title: "Deal" }} />
      <Stack.Screen name="edit/[id]" options={{ title: "Edit deal" }} />
    </Stack>
  );
}
