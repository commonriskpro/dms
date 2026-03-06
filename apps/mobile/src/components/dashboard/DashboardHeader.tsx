/**
 * Dashboard Header
 * Dark hero section: greeting (small), name (large), date (muted), right actions
 * Premium spacing and hierarchy to match approved mock.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "./styles";

interface DashboardHeaderProps {
  userName?: string;
  dealershipName?: string;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  onMessagePress?: () => void;
  notificationCount?: number;
}

export function DashboardHeader({
  userName,
  dealershipName,
  onNotificationPress,
  onProfilePress,
  onMessagePress,
  notificationCount = 0,
}: DashboardHeaderProps) {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const displayName = userName?.split("@")[0] || "there";

  return (
    <>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Subtle gradient effect: darker top, slightly lighter bottom */}
        <View style={styles.gradientOverlay} />
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          {/* Top Row - Right actions only */}
          <View style={styles.topRow}>
            <View style={styles.flex1} />
            <View style={styles.actions}>
              {onMessagePress != null && (
                <TouchableOpacity
                  onPress={onMessagePress}
                  style={styles.iconButton}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons
                    name="mail-outline"
                    size={22}
                    color="rgba(255,255,255,0.9)"
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={onNotificationPress}
                style={styles.iconButton}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons
                  name="notifications-outline"
                  size={22}
                  color="rgba(255,255,255,0.9)"
                />
                {notificationCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onProfilePress}
                style={styles.profileButton}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons
                  name="person-circle-outline"
                  size={30}
                  color="rgba(255,255,255,0.9)"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Greeting block: line 1 greeting, line 2 name; then date (muted) */}
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.name}>{displayName} 👋</Text>
            <Text style={styles.date}>{today}</Text>
            {dealershipName ? (
              <Text style={styles.dealership}>{dealershipName}</Text>
            ) : null}
          </View>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.darkHeader,
    paddingBottom: spacing.xxxl,
    overflow: "hidden",
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    // Slightly lighter at bottom for depth (no extra deps)
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  safeArea: {
    paddingHorizontal: spacing.screenHorizontal,
  },
  flex1: { flex: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  profileButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: typography.weightBold,
    color: colors.textInverse,
  },
  greetingContainer: {
    marginTop: spacing.xs,
  },
  greeting: {
    fontSize: typography.sizeLg,
    fontWeight: typography.weightRegular,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 24,
  },
  name: {
    fontSize: typography.sizeXxl,
    fontWeight: typography.weightBold,
    color: colors.textInverse,
    marginTop: spacing.xs,
    lineHeight: 32,
  },
  date: {
    fontSize: typography.sectionSubtitle,
    fontWeight: typography.weightRegular,
    color: "rgba(255,255,255,0.5)",
    marginTop: spacing.xs,
  },
  dealership: {
    fontSize: typography.sectionSubtitle,
    fontWeight: typography.weightMedium,
    color: "rgba(255,255,255,0.6)",
    marginTop: spacing.xs,
  },
});
