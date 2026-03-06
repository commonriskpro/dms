"use client";

import type { LucideIcon } from "@/lib/ui/icons";

export type IconProps = {
  icon: LucideIcon;
  size?: number;
  className?: string;
};

export function Icon({ icon: IconComponent, size = 16, className }: IconProps) {
  return <IconComponent size={size} className={className} aria-hidden />;
}
