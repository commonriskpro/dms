/**
 * KPI Grid Component
 * 2x2 grid of large, premium KPI cards with consistent gutter
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import { KpiCard } from "./KpiCard";
import { spacing } from "./styles";
import type { DashboardV3Metrics } from "@/api/endpoints";

interface KpiGridProps {
  metrics: DashboardV3Metrics;
  onInventoryPress?: () => void;
  onLeadsPress?: () => void;
  onDealsPress?: () => void;
  onSoldPress?: () => void;
  variant?: "light" | "dark";
}

const CARD_GAP = 12;

export function KpiGrid({
  metrics,
  onInventoryPress,
  onLeadsPress,
  onDealsPress,
  onSoldPress,
  variant = "dark",
}: KpiGridProps) {
  const formatDelta = (delta: number | null): string | undefined => {
    if (delta === null || delta === undefined) return undefined;
    const sign = delta >= 0 ? "+" : "";
    return `${sign}${delta} this week`;
  };

  const getTrendDirection = (delta: number | null): "up" | "down" | "neutral" => {
    if (delta === null || delta === undefined) return "neutral";
    if (delta > 0) return "up";
    if (delta < 0) return "down";
    return "neutral";
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <KpiCard
          label="Inventory"
          value={metrics.inventoryCount.toLocaleString()}
          trend={formatDelta(metrics.inventoryDelta7d)}
          trendDirection={getTrendDirection(metrics.inventoryDelta7d)}
          icon="car-outline"
          onPress={onInventoryPress}
          variant={variant}
        />
        <View style={styles.gap} />
        <KpiCard
          label="Leads Today"
          value={metrics.leadsCount.toLocaleString()}
          trend={formatDelta(metrics.leadsDelta7d)}
          trendDirection={getTrendDirection(metrics.leadsDelta7d)}
          icon="people-outline"
          onPress={onLeadsPress}
          variant={variant}
        />
      </View>
      <View style={[styles.row, styles.secondRow]}>
        <KpiCard
          label="Working Deals"
          value={metrics.dealsCount.toLocaleString()}
          trend={formatDelta(metrics.dealsDelta7d)}
          trendDirection={getTrendDirection(metrics.dealsDelta7d)}
          icon="document-text-outline"
          onPress={onDealsPress}
          variant={variant}
        />
        <View style={styles.gap} />
        <KpiCard
          label="Sold Today"
          value="0"
          trend={undefined}
          icon="checkmark-circle-outline"
          onPress={onSoldPress}
          variant={variant}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.screenHorizontal,
  },
  row: { flexDirection: "row" },
  secondRow: { marginTop: CARD_GAP },
  gap: { width: CARD_GAP },
});
