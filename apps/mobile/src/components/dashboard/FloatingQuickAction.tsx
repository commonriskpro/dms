/**
 * Floating Quick Action Button
 * Large circular FAB positioned bottom-right
 */

import React, { useState, useCallback } from "react";
import { View, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, shadows } from "./styles";

interface FloatingQuickActionProps {
  onAddDeal?: () => void;
  onAddCustomer?: () => void;
  onAddAppointment?: () => void;
  onRecordSale?: () => void;
}

export function FloatingQuickAction({
  onAddDeal,
  onAddCustomer,
  onAddAppointment,
  onRecordSale,
}: FloatingQuickActionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const animation = useState(new Animated.Value(0))[0];

  const toggleMenu = useCallback(() => {
    const toValue = isOpen ? 0 : 1;
    Animated.spring(animation, {
      toValue,
      friction: 7,
      tension: 40,
      useNativeDriver: true,
    }).start();
    setIsOpen(!isOpen);
  }, [isOpen, animation]);

  const actions = [
    { icon: "person-add", onPress: onAddCustomer, delay: 0 },
    { icon: "calendar", onPress: onAddAppointment, delay: 1 },
    { icon: "document-text", onPress: onAddDeal, delay: 2 },
    { icon: "cash", onPress: onRecordSale, delay: 3 },
  ].filter((action) => action.onPress);

  const renderActionButtons = () => {
    return actions.map((action, index) => {
      const translateY = animation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -70 * (index + 1)],
      });

      const opacity = animation.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 0, 1],
      });

      const scale = animation.interpolate({
        inputRange: [0, 1],
        outputRange: [0.5, 1],
      });

      return (
        <Animated.View
          key={action.icon}
          style={[
            styles.actionButtonContainer,
            {
              transform: [{ translateY }, { scale }],
              opacity,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => {
              action.onPress?.();
              toggleMenu();
            }}
            style={styles.actionButton}
            activeOpacity={0.8}
          >
            <Ionicons name={action.icon} size={22} color={colors.textInverse} />
          </TouchableOpacity>
        </Animated.View>
      );
    });
  };

  const rotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  return (
    <View style={styles.container} pointerEvents="box-none">
      {renderActionButtons()}

      <TouchableOpacity
        onPress={toggleMenu}
        style={styles.mainButton}
        activeOpacity={0.8}
      >
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Ionicons name="add" size={32} color={colors.textInverse} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const FAB_BOTTOM = 108; // Safely above tab bar

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: spacing.screenHorizontal,
    bottom: FAB_BOTTOM,
    alignItems: "center",
    zIndex: 1000,
  },
  mainButton: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  actionButtonContainer: {
    position: "absolute",
    bottom: 0,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primaryDark,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.md,
  },
});
