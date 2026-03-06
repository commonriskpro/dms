import { Stack } from "expo-router";

export default function EditVehicleLayout() {
  return <Stack screenOptions={{ headerBackTitle: "Back", title: "Edit vehicle", headerShown: true }} />;
}
