/**
 * Deal Pipeline Section
 * Horizontal scrollable pipeline stages with counts
 */

import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PipelineStageChip } from "./PipelineStageChip";
import { colors, spacing, typography, commonStyles } from "./styles";
import type { DashboardWidgetRow } from "@/api/endpoints";

interface DealPipelineSectionProps {
  stages: DashboardWidgetRow[];
  onStagePress?: (stageKey: string) => void;
  onViewAllPress?: () => void;
}

// Map backend keys to display labels
const stageLabelMap: Record<string, string> = {
  pendingDeals: "Lead",
  submittedDeals: "Appt",
  contractsToReview: "Working",
  fundingIssues: "Funding",
  delivered: "Delivered",
};

export function DealPipelineSection({
  stages,
  onStagePress,
  onViewAllPress,
}: DealPipelineSectionProps) {
  const displayStages = stages.length > 0
    ? stages.map((stage) => ({
        key: stage.key,
        label: stageLabelMap[stage.key] || stage.label,
        count: stage.count,
        severity: stage.severity,
      }))
    : // Fallback stages if no data
      [
        { key: "lead", label: "Lead", count: 0, severity: undefined as const },
        { key: "appt", label: "Appt", count: 0, severity: undefined as const },
        { key: "working", label: "Working", count: 0, severity: undefined as const },
        { key: "funding", label: "Funding", count: 0, severity: undefined as const },
        { key: "delivered", label: "Delivered", count: 0, severity: undefined as const },
      ];

  return (
    <View style={commonStyles.section}>
      <View style={commonStyles.sectionHeader}>
        <Text style={commonStyles.sectionTitle}>Deal Pipeline</Text>
        {onViewAllPress && (
          <TouchableOpacity onPress={onViewAllPress} style={styles.viewAllTouch}>
            <Text style={styles.viewAll}>View All</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToAlignment="start"
      >
        {displayStages.map((stage) => (
          <PipelineStageChip
            key={stage.key}
            label={stage.label}
            count={stage.count}
            severity={stage.severity}
            onPress={() => onStagePress?.(stage.key)}
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
  },
  viewAllTouch: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewAll: {
    fontSize: typography.sizeSm,
    fontWeight: typography.weightMedium,
    color: colors.primary,
    marginRight: 2,
  },
});
