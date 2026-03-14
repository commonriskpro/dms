"use client";

import * as React from "react";
import { notificationTokens } from "@/lib/ui/tokens";

export type NotificationItemPayload = {
  id: string;
  title: string;
  body: string | null;
  readAt: string | null;
};

export function NotificationItem({
  notification,
  onClick,
}: {
  notification: NotificationItemPayload;
  onClick: () => void;
}) {
  const isUnread = notification.readAt == null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${notificationTokens.row} ${isUnread ? notificationTokens.rowUnread : ""}`}
    >
      <span className={isUnread ? notificationTokens.title : notificationTokens.titleRead}>
        {notification.title}
      </span>
      {isUnread && (
        <span className={notificationTokens.meta}>Unread</span>
      )}
      {notification.body && (
        <span className={`${notificationTokens.meta} line-clamp-1 mt-0.5`}>
          {notification.body}
        </span>
      )}
    </button>
  );
}

export function NotificationEmptyState({ message = "No notifications yet" }: { message?: string }) {
  return <div className={notificationTokens.empty}>{message}</div>;
}

export function NotificationLoadingState() {
  return (
    <div className={notificationTokens.empty}>Loading notifications…</div>
  );
}

type NotificationPanelProps = {
  children: React.ReactNode;
  title?: string;
};

export function NotificationPanel({ children, title = "Notifications" }: NotificationPanelProps) {
  return (
    <div className={notificationTokens.panel}>
      <div className={notificationTokens.panelHeader}>{title}</div>
      <div className="overflow-y-auto flex-1">{children}</div>
    </div>
  );
}
