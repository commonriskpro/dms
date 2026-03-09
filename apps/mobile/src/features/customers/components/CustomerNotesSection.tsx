import * as React from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import type { CustomerNote } from "@/api/endpoints";
import { formatDateTime } from "../utils";

const styles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  title: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 12, textTransform: "uppercase" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 10 },
  body: { fontSize: 15, lineHeight: 22 },
  meta: { fontSize: 12, color: "#666", marginTop: 8 },
  empty: { padding: 20, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#666" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 88,
    textAlignVertical: "top",
  },
  addRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  addButton: {
    backgroundColor: "#208AEF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  addButtonDisabled: { opacity: 0.6 },
  addButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  cancelButton: { paddingVertical: 12, paddingHorizontal: 16 },
  cancelText: { color: "#666", fontSize: 16 },
});

export function CustomerNotesSection({
  notes,
  isLoading,
  onAddNote,
  addNotePending,
}: {
  notes: CustomerNote[];
  isLoading?: boolean;
  onAddNote: (body: string) => Promise<void>;
  addNotePending?: boolean;
}) {
  const [draft, setDraft] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    const body = draft.trim();
    if (!body || addNotePending || submitting) return;
    setSubmitting(true);
    try {
      await onAddNote(body);
      setDraft("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Notes</Text>
      {isLoading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="small" />
        </View>
      ) : notes.length === 0 && !draft.trim() ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No notes yet</Text>
        </View>
      ) : (
        <>
          {notes.map((note) => (
            <View key={note.id} style={styles.card}>
              <Text style={styles.body}>{note.body}</Text>
              <Text style={styles.meta}>
                {note.createdByProfile?.fullName ?? note.createdByProfile?.email ?? "Unknown"} ·{" "}
                {formatDateTime(note.createdAt)}
              </Text>
            </View>
          ))}
        </>
      )}
      <TextInput
        style={styles.input}
        placeholder="Add a note…"
        placeholderTextColor="#999"
        value={draft}
        onChangeText={setDraft}
        multiline
        editable={!addNotePending && !submitting}
      />
      <View style={styles.addRow}>
        <TouchableOpacity
          style={[styles.addButton, (addNotePending || submitting || !draft.trim()) && styles.addButtonDisabled]}
          onPress={handleSubmit}
          disabled={addNotePending || submitting || !draft.trim()}
        >
          {(addNotePending || submitting) ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.addButtonText}>Add note</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
