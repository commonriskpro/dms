# Dashboard Personalization Hardening — Frontend Report (Step 3)

## Summary

Minimal frontend changes only: clearer error toasts for validation and rate-limit responses from the layout API. No layout or UX redesign.

## Changes

- **DashboardCustomizePanel.tsx**
  - On save failure: if status 429, show "Too many requests. Try again in a minute."; if VALIDATION_ERROR and message contains "too large", show "Layout too large. Remove some widgets and try again."; otherwise show API message or "Failed to save layout".
  - On reset failure: if status 429, show "Too many requests. Try again in a minute."; otherwise "Failed to reset layout".

## Unchanged

- Dashboard remains server-first; no fetch-on-mount.
- Customization panel UX and layout unchanged.
- No new components or design-system changes.
- Layout item type already supports optional fields; no typing change for version.
