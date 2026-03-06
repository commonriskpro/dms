import { Stack } from "expo-router";

export default function DealsLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ title: "Deals" }} />
      <Stack.Screen name="[id]" options={{ title: "Deal" }} />
    </Stack>
  );
}
