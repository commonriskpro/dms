"use client";

import { useRouter } from "next/navigation";
import { AppModal } from "@/components/ui/app-modal";
import { SettingsContent } from "@/modules/settings/ui/SettingsContent";

export function SettingsModal() {
  const router = useRouter();

  const handleRequestClose = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <AppModal
      open
      onOpenChange={() => {}}
      title="Settings"
      closeBehavior="back"
      onRequestClose={handleRequestClose}
    >
      <SettingsContent />
    </AppModal>
  );
}
