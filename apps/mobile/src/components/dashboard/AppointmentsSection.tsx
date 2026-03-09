/**
 * Appointments Section
 * Card section showing today's appointments
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppointmentRow } from "./AppointmentRow";
import { colors, spacing, typography, radius, shadows, commonStyles } from "./styles";
import type { DashboardV3Appointment } from "@/api/endpoints";

interface AppointmentsSectionProps {
  appointments: DashboardV3Appointment[];
  onAppointmentPress?: (appointmentId: string) => void;
  onViewAllPress?: () => void;
}

// Fallback appointments for demo
const fallbackAppointments = [
  {
    id: "apt-1",
    time: "10:30 AM",
    title: "Test Drive",
    subtitle: "John Smith • 2024 Ford F-150",
    meta: undefined,
    status: "confirmed" as const,
  },
  {
    id: "apt-2",
    time: "2:00 PM",
    title: "Finance Signing",
    subtitle: "Mike & Lisa Thompson • Honda Accord",
    meta: undefined,
    status: "confirmed" as const,
  },
];

export function AppointmentsSection({
  appointments,
  onAppointmentPress,
  onViewAllPress,
}: AppointmentsSectionProps) {
  const displayAppointments = appointments.length > 0
    ? appointments.map((apt) => ({
        id: apt.id,
        time: apt.timeLabel || "TBD",
        title: apt.name,
        subtitle: apt.meta,
        meta: undefined,
        status: "confirmed" as const,
      }))
    : fallbackAppointments;

  const todayDate = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <View style={commonStyles.section}>
      <View style={commonStyles.sectionHeader}>
        <View>
          <Text style={commonStyles.sectionTitle}>Today&apos;s Appointments</Text>
          <Text style={commonStyles.sectionSubtitle}>{todayDate}</Text>
        </View>
        {onViewAllPress && (
          <TouchableOpacity onPress={onViewAllPress} style={styles.viewAllRow}>
            <Text style={styles.viewAll}>Calendar</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        {displayAppointments.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="calendar-outline"
              size={32}
              color={colors.textMuted}
            />
            <Text style={styles.emptyText}>No appointments today</Text>
          </View>
        ) : (
          displayAppointments.map((apt, index) => (
            <View key={apt.id}>
              <AppointmentRow
                time={apt.time}
                title={apt.title}
                subtitle={apt.subtitle}
                meta={apt.meta}
                status={apt.status}
                onPress={() => onAppointmentPress?.(apt.id)}
              />
              {index < displayAppointments.length - 1 && (
                <View style={commonStyles.rowBorder} />
              )}
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewAllRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewAll: {
    fontSize: typography.sizeSm,
    fontWeight: typography.weightMedium,
    color: colors.primary,
    marginRight: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    marginHorizontal: spacing.screenHorizontal,
    ...shadows.md,
    overflow: "hidden",
  },
  emptyState: {
    padding: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    marginTop: spacing.md,
    fontSize: typography.sizeMd,
    color: colors.textMuted,
  },
});
