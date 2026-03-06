/**
 * Follow Ups Section
 * Large white card with list of follow-up tasks
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FollowUpRow } from "./FollowUpRow";
import { colors, spacing, typography, radius, shadows, commonStyles } from "./styles";
import type { DashboardWidgetRow } from "@/api/endpoints";

interface FollowUpsSectionProps {
  tasks: DashboardWidgetRow[];
  overdueCount?: number;
  onTaskPress?: (taskKey: string) => void;
  onViewAllPress?: () => void;
}

// Sample fallback tasks for demo
const fallbackTasks = [
  {
    key: "call-john",
    icon: "call-outline" as const,
    title: "Call John Smith",
    subtitle: "Follow up on financing options",
    meta: "Due 2 hours ago",
    overdue: true,
    iconColor: colors.success,
  },
  {
    key: "send-docs",
    icon: "mail-outline" as const,
    title: "Send docs to Maria Garcia",
    subtitle: "Purchase agreement & disclosures",
    meta: "Due today at 3:00 PM",
    overdue: false,
    iconColor: colors.primary,
  },
  {
    key: "appt",
    icon: "calendar-outline" as const,
    title: "Appointment at 3:30 PM",
    subtitle: "Test drive - 2024 Honda Accord",
    meta: "Customer: David Chen",
    overdue: false,
    iconColor: colors.warning,
  },
];

export function FollowUpsSection({
  tasks,
  overdueCount,
  onTaskPress,
  onViewAllPress,
}: FollowUpsSectionProps) {
  const displayTasks = tasks.length > 0
    ? tasks.map((task, index) => ({
        key: task.key,
        icon: "checkbox-outline" as const,
        title: task.label,
        subtitle: `${task.count} items`,
        meta: undefined,
        overdue: task.severity === "danger",
        iconColor: task.severity === "danger" ? colors.danger : colors.primary,
      }))
    : fallbackTasks;

  return (
    <View style={commonStyles.section}>
      {/* Section Header */}
      <View style={commonStyles.sectionHeader}>
        <View>
          <Text style={commonStyles.sectionTitle}>Follow Ups Today</Text>
          <Text style={commonStyles.sectionSubtitle}>
            {displayTasks.length} tasks pending
          </Text>
        </View>
        {overdueCount !== undefined && overdueCount > 0 && (
          <TouchableOpacity style={styles.overdueBadge}>
            <Text style={styles.overdueText}>{overdueCount} overdue</Text>
            <Ionicons name="chevron-forward" size={12} color={colors.danger} style={styles.overdueChevron} />
          </TouchableOpacity>
        )}
      </View>

      {/* Card */}
      <View style={styles.card}>
        {displayTasks.map((task, index) => (
          <View key={task.key}>
            <FollowUpRow
              icon={task.icon}
              iconColor={task.iconColor}
              title={task.title}
              subtitle={task.subtitle}
              meta={task.meta}
              overdue={task.overdue}
              onPress={() => onTaskPress?.(task.key)}
            />
            {index < displayTasks.length - 1 && (
              <View style={commonStyles.rowBorder} />
            )}
          </View>
        ))}

        {/* Footer */}
        {onViewAllPress && (
          <TouchableOpacity
            onPress={onViewAllPress}
            style={styles.footer}
            activeOpacity={0.7}
          >
            <Text style={styles.footerText}>View all tasks</Text>
            <Ionicons
              name="arrow-forward"
              size={16}
              color={colors.primary}
              style={styles.footerIcon}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overdueBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.1)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  overdueText: {
    fontSize: typography.sizeXs,
    fontWeight: typography.weightSemibold,
    color: colors.danger,
  },
  overdueChevron: {
    marginLeft: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    marginHorizontal: spacing.screenHorizontal,
    ...shadows.md,
    overflow: "hidden",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  footerText: {
    fontSize: typography.sizeSm,
    fontWeight: typography.weightMedium,
    color: colors.primary,
  },
  footerIcon: {
    marginLeft: spacing.xs,
  },
});
