import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import type { TimelineEvent, TimelineEventType } from "@/api/endpoints";
import { formatDateTime } from "../utils";

const typeLabel: Record<TimelineEventType, string> = {
  NOTE: "Note",
  CALL: "Call",
  CALLBACK: "Callback",
  APPOINTMENT: "Appointment",
  SYSTEM: "Activity",
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  title: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 12, textTransform: "uppercase" },
  empty: { padding: 20, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#666" },
  timeline: {},
  item: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#208AEF", marginTop: 6 },
  content: { flex: 1 },
  type: { fontSize: 12, color: "#666", textTransform: "uppercase", marginBottom: 2 },
  time: { fontSize: 12, color: "#999" },
  payload: { fontSize: 14, color: "#333", marginTop: 4 },
});

export function CustomerActivitySection({
  events,
  isLoading,
}: {
  events: TimelineEvent[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Activity</Text>
        <View style={styles.empty}>
          <ActivityIndicator size="small" />
        </View>
      </View>
    );
  }
  if (!events.length) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Activity</Text>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Notes, calls, and callbacks will appear here.</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Activity</Text>
      <View style={styles.timeline}>
        {events.map((evt, i) => (
          <View key={`${evt.type}-${evt.sourceId}-${evt.createdAt}-${i}`} style={styles.item}>
            <View style={styles.dot} />
            <View style={styles.content}>
              <Text style={styles.type}>{typeLabel[evt.type]}</Text>
              <Text style={styles.time}>{formatDateTime(evt.createdAt)}</Text>
              {evt.type === "NOTE" && typeof evt.payloadJson?.body === "string" && (
                <Text style={styles.payload} numberOfLines={2}>
                  {evt.payloadJson.body}
                </Text>
              )}
              {evt.type === "CALL" && (evt.payloadJson?.summary ?? evt.payloadJson?.direction) && (
                <Text style={styles.payload} numberOfLines={2}>
                  {[evt.payloadJson.direction, evt.payloadJson.summary].filter(Boolean).join(" — ")}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
