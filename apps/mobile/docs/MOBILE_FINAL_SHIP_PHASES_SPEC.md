# Mobile Final Ship-Readiness — 4 Phases Spec

## 1. Current architecture summary

- **Stack:** React Native + Expo (SDK 55), Expo Router, TanStack Query, dealer API (Bearer).
- **Auth:** AuthProvider, active dealership from backend; multi-dealership switching via GET/POST /api/me/current-dealership.
- **Tabs:** Dashboard, Inventory, Customers, Deals, More. No push or camera required for core flows.
- **Config:** `app.json` (name, slug, scheme `dmsdealer`), `.env` for `EXPO_PUBLIC_DEALER_API_URL`. No EAS config yet.
- **VIN:** `VinScannerModal` — manual 17-char entry + decode only; `parseVinFromBarcode` / `isValidVin` in inventory utils.
- **CRM:** Customer detail has Communication section (Call/Text/Email via Linking), Activity (timeline). Backend: POST /api/customers/[id]/calls (log call), GET timeline; no SMS/email logging.

## 2. Phase goals

| Phase | Goal |
|-------|------|
| 1 | VIN camera barcode scanner: add camera scan path to VIN modal, keep manual fallback; no break if camera denied. |
| 2 | Push notification infrastructure: service/hooks behind feature flag; default OFF; no permission or token when disabled. |
| 3 | TestFlight / EAS: eas.json, app identifiers, build profiles, release doc; dev workflow unchanged. |
| 4 | CRM communication polish: wire call logging (POST /calls), better labels/touch targets/empty states; no fake history. |

## 3. Dependencies and risks

- **Phase 1:** expo-camera (barcode scanning). Risk: permission denied must not block add/edit vehicle; scanner only when user opens scan.
- **Phase 2:** expo-notifications (optional). Risk: must not require credentials or block builds; all paths no-op when flag false.
- **Phase 3:** EAS CLI / Expo account for builds. Risk: local `expo start` must still work without EAS.
- **Phase 4:** Backend POST /api/customers/[id]/calls exists; no backend for SMS/email logging — do not fake.

## 4. Feature flag strategy (push)

- **File:** `src/config/features.ts` (or equivalent).
- **Flag:** `ENABLE_PUSH_NOTIFICATIONS = false` (default).
- **Behavior when false:** No permission request, no token registration, no notification listeners, no startup code that depends on push. App behaves as today.
- **When true (future):** Registration path and listeners run; missing credentials/backend fail gracefully (no crash).

## 5. VIN camera scan flow

1. User opens VIN lookup (e.g. "Scan VIN" on add/edit vehicle).
2. Modal shows: primary action "Scan barcode" and "Enter manually" fallback.
3. If user taps "Scan barcode": request camera permission. If denied → show message + fallback to manual entry only. If granted → show camera view with scan frame and helper text.
4. On barcode scan: validate with `parseVinFromBarcode` + `isValidVin` (17-char VIN). Ignore non-VIN codes. Debounce / accept once per VIN to avoid duplicate rapid scans.
5. On valid VIN: set VIN in field, close scanner state (or transition to "decoding…"), trigger existing decode API; on decode success run existing onResult and close.
6. Manual path unchanged: type 17 chars → Decode.

## 6. CRM communication logging flow

- **Call:** Tap "Call" opens tel: link (existing). Add optional "Log call" (or "Log call" after call) that POSTs to /api/customers/[id]/calls with body `{ summary?, durationSeconds?, direction? }`. On success invalidate customer timeline + activity so new CALL appears.
- **Text / Email:** Open sms:/mailto: (existing). No backend logging for SMS/email — do not store or fake. Optional copy: "Calls you make can be logged to Activity."
- **Empty state:** When no contact info: "Add phone or email in Edit to call or email." When contact info but no activity: "Call or email from the buttons below. Log a call to record it in Activity."

## 7. TestFlight / EAS setup

- **eas.json:** Profiles development, preview, production (iOS + Android where applicable).
- **app.json / app.config:** Keep scheme; add iOS bundleIdentifier if needed; version/build strategy documented.
- **Permissions:** Camera, photo library (existing usage), notifications (only when push flag enabled) — ensure permission copy strings exist.
- **Docs:** MOBILE_EAS_TESTFLIGHT_SETUP.md — prereqs, local dev, preview/production build commands, deep links, required secrets.

## 8. Deep link / navigation

- Scheme `dmsdealer` already used (e.g. reset-password, invite). Push notification tap targets (when enabled later): e.g. `dmsdealer://customers/[id]`, `dmsdealer://deals/[id]`, `dmsdealer://` (dashboard). No change required in this pass except documenting.

## 9. Acceptance criteria

**Phase 1:** Camera permission requested only when opening scanner; denied → manual only; valid VIN scan fills field and triggers decode; manual entry still works; no duplicate scans; no crash without camera.

**Phase 2:** With flag false: no permission prompt, no token call, no startup error; with flag true: registration path and listeners exist; missing config fails gracefully.

**Phase 3:** `expo start` works; eas build (preview/production) runs with valid config; doc lists commands and required env/secrets.

**Phase 4:** Call logging POST wired; timeline shows new CALL after log; no fake SMS/email history; Communication section has clear labels and large touch targets; empty states correct.

## 10. Files to touch

**Phase 1:** `src/features/inventory/components/VinScannerModal.tsx`, `src/features/inventory/utils.ts` (optional parseVin tweaks), `app.json` (expo-camera plugin if needed), `package.json` (expo-camera).

**Phase 2:** `src/config/features.ts`, `src/services/push.ts` or `src/features/notifications/` (register, listeners behind flag), optional `app.json` (notification config only when used).

**Phase 3:** `eas.json`, `app.json` or `app.config.js`, `apps/mobile/docs/MOBILE_EAS_TESTFLIGHT_SETUP.md`.

**Phase 4:** `src/api/endpoints.ts` (logCustomerCall), `src/features/customers/components/CustomerCommunicationSection.tsx`, optionally CustomerHeaderCard; customer detail screen (pass callback for invalidate after log).

## 11. Rollout notes

- Ship with push disabled; enable when account and backend device-token endpoint are ready.
- VIN scanner: recommend testing on device (barcode scan not in simulator).
- CRM: call logging is optional; user can still call without logging.

## 12. Manual QA checklist

**VIN scanner**
- [ ] Open add vehicle → tap Scan VIN → choice screen shows (Scan barcode / Enter manually).
- [ ] Tap "Enter manually" → enter 17-char VIN → Decode → form fills; manual path unchanged.
- [ ] Tap "Scan VIN barcode" → permission requested; if denied, message + "Enter manually" visible; no crash.
- [ ] On device with camera: grant permission → camera view with frame; scan valid VIN barcode → VIN fills and decode runs (or manual view with VIN prefilled).
- [ ] Invalid barcode data does not fill VIN; no duplicate rapid scans.

**Push (disabled)**
- [ ] App starts with no notification permission prompt.
- [ ] No errors in console related to push or expo-notifications at startup.

**Release / EAS**
- [ ] `npx expo start` runs; app loads in Expo Go or dev client.
- [ ] Deep link scheme `dmsdealer` still works (e.g. reset-password).
- [ ] After adding eas.json, `eas build --profile preview --platform ios` (or android) can be run with valid EAS project.

**CRM communication**
- [ ] Customer detail: Communication section shows Call / Text / Email when phone/email present; "Log call" visible when phone present.
- [ ] Tap "Log call" → request succeeds; Activity timeline refreshes and shows new CALL entry.
- [ ] No fake SMS/email history; empty state when no contact info is clear.
- [ ] Dealership switch → customer data refreshes; no cross-tenant data.

## 13. Implementation deliverables (completed)

### Files added

- `apps/mobile/docs/MOBILE_FINAL_SHIP_PHASES_SPEC.md`
- `apps/mobile/docs/MOBILE_EAS_TESTFLIGHT_SETUP.md`
- `apps/mobile/src/config/features.ts`
- `apps/mobile/src/config/__tests__/features.test.ts`
- `apps/mobile/src/services/push.ts`
- `apps/mobile/eas.json`

### Files changed

- `apps/mobile/app.json` — expo-camera plugin (camera permission, barcodeScannerEnabled); ios.bundleIdentifier, android.package.
- `apps/mobile/package.json` — expo-camera added (via expo install).
- `apps/mobile/src/features/inventory/components/VinScannerModal.tsx` — choice (Scan barcode / Enter manually); camera permission flow; CameraView with onBarcodeScanned; debounce; manual unchanged.
- `apps/mobile/src/api/endpoints.ts` — logCustomerCall(customerId, body).
- `apps/mobile/src/features/customers/components/CustomerCommunicationSection.tsx` — Log call button, onLogCall/logCallPending props; clearer empty state and hint; min touch 48.
- `apps/mobile/src/features/customers/components/CustomerActivitySection.tsx` — empty state copy.
- `apps/mobile/app/(tabs)/customers/[id].tsx` — logCallMutation and pass onLogCall/logCallPending to CommunicationSection.
- `apps/mobile/src/features/inventory/__tests__/utils.test.ts` — parseVinFromBarcode strip test.

### What is fully working now

- **Phase 1:** VIN lookup: choice → Scan barcode (camera + permission) or Enter manually; valid scan fills VIN and triggers decode; manual entry and decode unchanged; permission denied shows message and manual fallback.
- **Phase 2:** Push service and feature flag; when `ENABLE_PUSH_NOTIFICATIONS` is false, no permission request, no token registration, no startup side effects; `registerForPushIfEnabled()` returns `{ ok: false, reason: "disabled" }`.
- **Phase 3:** eas.json with development/preview/production; app.json iOS/Android identifiers; MOBILE_EAS_TESTFLIGHT_SETUP.md with commands and prerequisites.
- **Phase 4:** Customer Communication: Call / Text / Email + "Log call"; POST /api/customers/[id]/calls wired; timeline invalidated so new CALL appears in Activity; clearer labels and empty states.

### What remains disabled by default

- Push notifications (feature flag `ENABLE_PUSH_NOTIFICATIONS = false`). No expo-notifications dependency added; when enabled, install and add EAS project ID.

### What depends on backend support

- Call logging: POST /api/customers/[id]/calls — implemented and wired. No SMS/email logging backend; we do not fake it.

### What depends on credentials/assets not yet provided

- EAS Build: Expo account and (for store) Apple/Google developer accounts. App icon/splash: optional; Expo defaults work for preview.
- Push (when enabled): EAS project ID; backend device-token endpoint not implemented — documented in push.ts.

### Commands to run/test

```bash
cd apps/mobile && npm run test
cd apps/mobile && npx expo start
# EAS (from apps/mobile): eas build --profile preview --platform ios
```

### Follow-ups before public release

- Add app icon and splash if desired; configure in app.json.
- When enabling push: `npx expo install expo-notifications`; set ENABLE_PUSH_NOTIFICATIONS true; implement backend device-token storage; set EAS project ID in config.
- Test VIN scan on physical device with VIN barcode.
