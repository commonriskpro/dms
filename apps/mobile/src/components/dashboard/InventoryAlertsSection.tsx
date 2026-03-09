/**
 * Inventory Alerts Section
 * Horizontally scrollable alert tiles for inventory issues
 */

import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { AlertTile } from "./AlertTile";
import { colors, spacing, typography, commonStyles } from "./styles";
import type { DashboardWidgetRow } from "@/api/endpoints";

interface InventoryAlertsSectionProps {
  alerts: DashboardWidgetRow[];
  onAlertPress?: (alertKey: string) => void;
  onViewAllPress?: () => void;
}

// Map backend keys to display config
const alertConfig: Record<string, { title: string; icon: string }> = {
  carsInRecon: { title: "Cars in Recon", icon: "construct" },
  pendingTasks: { title: "Pending Tasks", icon: "time" },
  notPostedOnline: { title: "Not Posted", icon: "cloud-upload" },
  missingDocs: { title: "Missing Docs", icon: "document" },
  lowStock: { title: "Low Stock", icon: "alert" },
};

// Fallback alerts for demo
const fallbackAlerts = [
  { key: "missing-photos", title: "Missing Photos", count: 5, severity: "warning" as const, icon: "camera-outline" as const },
  { key: "stale-inventory", title: "Stale Inventory", count: 12, severity: "danger" as const, icon: "time-outline" as const },
  { key: "recon-needed", title: "Recon Needed", count: 3, severity: "warning" as const, icon: "construct-outline" as const },
];

export function InventoryAlertsSection({
  alerts,
  onAlertPress,
  onViewAllPress,
}: InventoryAlertsSectionProps) {
  const displayAlerts = alerts.length > 0
    ? alerts.map((alert) => ({
        key: alert.key,
        title: alertConfig[alert.key]?.title || alert.label,
        count: alert.count,
        severity: alert.severity || "info",
        icon: (alertConfig[alert.key]?.icon ? `${alertConfig[alert.key].icon}-outline` : "alert-circle-outline") as const,
      }))
    : fallbackAlerts;

  return (
    <View style={commonStyles.section}>
      <View style={commonStyles.sectionHeader}>
        <Text style={commonStyles.sectionTitle}>Inventory Alerts</Text>
        {onViewAllPress && (
          <TouchableOpacity onPress={onViewAllPress}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
      >
        {displayAlerts.map((alert) => (
          <AlertTile
            key={alert.key}
            title={alert.title}
            count={alert.count}
            severity={alert.severity}
            icon={alert.icon}
            onPress={() => onAlertPress?.(alert.key)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  viewAll: {
    fontSize: typography.sizeSm,
    fontWeight: typography.weightMedium,
    color: colors.primary,
  },
});
