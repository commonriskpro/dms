import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useDealerships, useCurrentDealership, useSwitchDealership } from "../hooks";
import type { MeDealershipItem } from "../types";

const SECTION_SEP = "────────────────────";
const MIN_TOUCH_HEIGHT = 48;

function DealershipRow({
  item,
  isActive,
  onPress,
  disabled,
}: {
  item: MeDealershipItem;
  isActive: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.dealershipRow, disabled && styles.dealershipRowDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, selected: isActive }}
    >
      <Text style={styles.dealershipRowName} numberOfLines={1}>
        {item.dealershipName}
      </Text>
      {isActive && <Text style={styles.checkmark}>✓</Text>}
    </TouchableOpacity>
  );
}

export function DealershipSwitcherCard() {
  const { data: dealershipsData, isLoading: listLoading, error: listError } = useDealerships();
  const { data: currentData, isLoading: currentLoading } = useCurrentDealership();
  const switchMutation = useSwitchDealership();

  const dealerships = dealershipsData?.data?.dealerships ?? [];
  const current = currentData?.data ?? null;
  const isLoading = listLoading || currentLoading;
  const isSwitching = switchMutation.isPending;

  if (listError) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dealership</Text>
        <Text style={styles.errorText}>Could not load dealerships. Pull to refresh.</Text>
      </View>
    );
  }

  if (isLoading && dealerships.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dealership</Text>
        <ActivityIndicator size="small" style={styles.loader} />
      </View>
    );
  }

  if (dealerships.length <= 1) {
    return null;
  }

  const handleSwitch = (item: MeDealershipItem) => {
    if (item.isActive) return;
    Alert.alert(
      "Switch dealership?",
      `You are switching to ${item.dealershipName}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch",
          onPress: () => {
            switchMutation.mutate(item.dealershipId, {
              onSuccess: (res) => {
                const name = res?.data?.dealershipName ?? item.dealershipName ?? "new dealership";
                Alert.alert("Switched", `Switched to ${name}`);
              },
              onError: (e) => {
                const message = e instanceof Error ? e.message : "Switch failed. Try again.";
                Alert.alert("Switch failed", message);
              },
            });
          },
        },
      ]
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Current dealership</Text>
      <Text style={styles.sectionSep}>{SECTION_SEP}</Text>
      <View style={styles.currentBlock}>
        <Text style={styles.currentName}>{current?.dealershipName ?? "—"}</Text>
        <Text style={styles.currentRole}>Role: {current?.roleName ?? "—"}</Text>
      </View>

      <Text style={[styles.sectionTitle, styles.switchTitle]}>Switch dealership</Text>
      <Text style={styles.sectionSep}>{SECTION_SEP}</Text>
      {isSwitching && (
        <View style={styles.switchingRow}>
          <ActivityIndicator size="small" />
          <Text style={styles.switchingText}>Switching…</Text>
        </View>
      )}
      <ScrollView style={styles.dealershipList} nestedScrollEnabled>
        {dealerships.map((item) => (
          <DealershipRow
            key={item.dealershipId}
            item={item}
            isActive={item.isActive}
            onPress={() => handleSwitch(item)}
            disabled={item.isActive}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12,
    color: "#666",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sectionSep: {
    fontSize: 12,
    color: "#ccc",
    marginBottom: 12,
  },
  currentBlock: { marginBottom: 16 },
  currentName: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  currentRole: { fontSize: 14, color: "#666" },
  switchTitle: { marginTop: 8 },
  loader: { marginVertical: 12 },
  errorText: { fontSize: 14, color: "#c00", marginVertical: 8 },
  switchingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: MIN_TOUCH_HEIGHT,
    marginBottom: 8,
  },
  switchingText: { fontSize: 14, color: "#666" },
  dealershipList: { maxHeight: 240 },
  dealershipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: MIN_TOUCH_HEIGHT,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    marginBottom: 6,
  },
  dealershipRowDisabled: {
    opacity: 0.7,
    backgroundColor: "#eee",
  },
  dealershipRowName: { fontSize: 16, flex: 1 },
  checkmark: { fontSize: 18, fontWeight: "700", color: "#208AEF", marginLeft: 8 },
});
