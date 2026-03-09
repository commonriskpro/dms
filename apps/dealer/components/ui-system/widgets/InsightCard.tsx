import * as React from "react";
import { Widget } from "./Widget";

export type InsightCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
};

export function InsightCard({ title, subtitle, children, action }: InsightCardProps) {
  return (
    <Widget title={title} subtitle={subtitle} action={action}>
      {children}
    </Widget>
  );
}
