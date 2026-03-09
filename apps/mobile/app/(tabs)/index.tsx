/**
 * Dashboard Screen
 * Modern iPhone-optimized dealership dashboard with:
 * - Dark gradient header with greeting
 * - Large 2x2 KPI cards
 * - Horizontal deal pipeline
 * - Follow-ups section
 * - Inventory alerts
 * - Today's appointments
 * - Floating action button
 */

import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api, type DashboardV3Data } from "@/api/endpoints";
import { useAuth } from "@/auth/use-auth";
import { authDebug } from "@/lib/auth-debug";

import {
  DashboardHeader,
  KpiGrid,
  DealPipelineSection,
  FollowUpsSection,
  InventoryAlertsSection,
  AppointmentsSection,
  FloatingQuickAction,
  colors,
  spacing,
} from "@/components/dashboard";

export default function DashboardScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const { state, session } = useAuth();

  const canQuery =
    state.status === "authenticated" && !!session?.accessToken;

  authDebug("dashboard.render.auth-snapshot", {
    status: state.status,
    hasSessionAccessToken: Boolean(session?.accessToken),
    canQuery,
  });

  // Main dashboard query
  const {
    data: dashboardData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["dashboard", "v3"],
    queryFn: () => api.getDashboardV3(),
    enabled: canQuery,
    // Safe fallback data while loading
    placeholderData: (previousData) =>
      previousData || {
        data: {
          dashboardGeneratedAt: new Date().toISOString(),
          metrics: {
            inventoryCount: 0,
            inventoryDelta7d: null,
            inventoryDelta30d: null,
            leadsCount: 0,
            leadsDelta7d: null,
            leadsDelta30d: null,
            dealsCount: 0,
            dealsDelta7d: null,
            dealsDelta30d: null,
            bhphCount: 0,
            bhphDelta7d: null,
            bhphDelta30d: null,
          },
          customerTasks: [],
          inventoryAlerts: [],
          dealPipeline: [],
          floorplan: [],
          appointments: [],
          financeNotices: [],
        },
      },
  });

  const onRefresh = useCallback(async () => {
    if (!canQuery) return;
    authDebug("dashboard.refresh.start", { canQuery });
    setRefreshing(true);
    try {
      await refetch();
      authDebug("dashboard.refresh.success");
    } finally {
      setRefreshing(false);
    }
  }, [canQuery, refetch]);

  // Navigation handlers
  const navigateToInventory = () => router.push("/(tabs)/inventory");
  const navigateToCustomers = () => router.push("/(tabs)/customers");
  const navigateToDeals = () => router.push("/(tabs)/deals");

  // Loading states
  if (state.status === "loading") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.muted}>Loading session…</Text>
      </View>
    );
  }

  if (state.status !== "authenticated") {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Waiting for sign-in…</Text>
      </View>
    );
  }

  if ((isLoading || isFetching) && !dashboardData) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.muted}>Loading dashboard…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>
          {error instanceof Error ? error.message : "Something went wrong"}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const data = dashboardData?.data as DashboardV3Data | undefined;
  const metrics = data?.metrics || {
    inventoryCount: 0,
    inventoryDelta7d: null,
    inventoryDelta30d: null,
    leadsCount: 0,
    leadsDelta7d: null,
    leadsDelta30d: null,
    dealsCount: 0,
    dealsDelta7d: null,
    dealsDelta30d: null,
    bhphCount: 0,
    bhphDelta7d: null,
    bhphDelta30d: null,
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header Section */}
        <DashboardHeader
          userName={session?.user?.email}
          dealershipName={undefined}
          onNotificationPress={() => {}}
          onProfilePress={() => {}}
          onMessagePress={() => {}}
          notificationCount={0}
        />

        {/* KPI Grid - positioned in the dark header area */}
        <View style={styles.kpiSection}>
          <KpiGrid
            metrics={metrics}
            onInventoryPress={navigateToInventory}
            onLeadsPress={navigateToCustomers}
            onDealsPress={navigateToDeals}
            onSoldPress={() => {}}
            variant="dark"
          />
        </View>

        {/* Main Content - Light background */}
        <View style={styles.content}>
          {/* Deal Pipeline */}
          <DealPipelineSection
            stages={data?.dealPipeline || []}
            onStagePress={(stageKey) => {
              authDebug("dashboard.pipeline.press", { stageKey });
              navigateToDeals();
            }}
            onViewAllPress={navigateToDeals}
          />

          {/* Follow Ups */}
          <FollowUpsSection
            tasks={data?.customerTasks || []}
            overdueCount={0}
            onTaskPress={(taskKey) => {
              authDebug("dashboard.task.press", { taskKey });
            }}
            onViewAllPress={() => {}}
          />

          {/* Inventory Alerts */}
          <InventoryAlertsSection
            alerts={data?.inventoryAlerts || []}
            onAlertPress={(alertKey) => {
              authDebug("dashboard.alert.press", { alertKey });
              navigateToInventory();
            }}
            onViewAllPress={navigateToInventory}
          />

          {/* Appointments */}
          <AppointmentsSection
            appointments={data?.appointments || []}
            onAppointmentPress={(aptId) => {
              authDebug("dashboard.appointment.press", { aptId });
            }}
            onViewAllPress={() => {}}
          />

          {/* Bottom padding for FAB and tab bar */}
          <View style={styles.bottomPadding} />
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <FloatingQuickAction
        onAddDeal={() => router.push("/(tabs)/deals")}
        onAddCustomer={() => router.push("/(tabs)/customers")}
        onAddAppointment={() => {}}
        onRecordSale={() => router.push("/(tabs)/deals")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  kpiSection: {
    backgroundColor: colors.darkHeader,
    paddingBottom: spacing.sectionGap,
  },
  content: {
    backgroundColor: colors.background,
    paddingTop: spacing.sectionGap,
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },
  muted: {
    color: colors.textSecondary,
    fontSize: 16,
    marginTop: spacing.md,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  retryText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: "600",
  },
  bottomPadding: {
    height: 148, // FAB + tab bar clearance so content is never covered
  },
});
