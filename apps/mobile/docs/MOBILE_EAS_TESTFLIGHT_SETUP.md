# Mobile EAS / TestFlight setup

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g eas-cli` (or use `npx eas`)
- Expo account: https://expo.dev (required for EAS Build)
- For iOS distribution: Apple Developer account; for Android: Google Play (or internal only)

## Local development (unchanged)

From repo root or `apps/mobile`:

```bash
cd apps/mobile
npx expo start
```

Then press `i` for iOS simulator or `a` for Android emulator, or scan QR with Expo Go. No EAS account required for local dev.

## Build profiles (eas.json)

| Profile       | Use case              | Distribution | Notes                          |
|---------------|------------------------|--------------|--------------------------------|
| development   | Dev client, debugging | internal     | `developmentClient: true`      |
| preview       | Internal testers      | internal     | APK (Android), ad-hoc/simulator (iOS) |
| production    | TestFlight / Store    | store        | App Store / Play Store         |

## Commands

From **apps/mobile** (or repo root with `--local` or EAS project linked):

```bash
# Preview build (internal; no store submission)
eas build --profile preview --platform ios
eas build --profile preview --platform android

# Production build (for TestFlight / Store)
eas build --profile production --platform ios
eas build --profile production --platform android

# Submit to TestFlight (after production build)
eas submit --platform ios --latest
```

First run you may be prompted to log in and create/link an EAS project.

## App identifiers

- **iOS:** `ios.bundleIdentifier` in app.json (e.g. `com.dms.dealer.mobile`). Change if needed for your org.
- **Android:** `android.package` in app.json.
- **Version:** `expo.version` in app.json. For builds you can use `expo build:version` or EAS auto-versioning.

## Deep links / scheme

Scheme is `dmsdealer`. Example URLs:

- `dmsdealer://reset-password` — password reset
- `dmsdealer://customers/<id>` — customer detail (when push/notification payloads support it)
- `dmsdealer://deals/<id>` — deal detail

Test deep links: open in device simulator or use `npx uri-scheme open dmsdealer://customers/xxx --ios`.

## Secrets / environment

For EAS Build you can set env and secrets so the built app has the right API URL etc.:

- In Expo dashboard: Project → Secrets (e.g. `EXPO_PUBLIC_DEALER_API_URL`).
- Or `eas secret:create` from CLI.

Local dev uses `.env` in apps/mobile (see README). Do not commit `.env`; use `.env.example` as a template.

## Permissions

- **Camera:** Used for VIN barcode scanning. Message in app.json plugin: "Allow DMS Dealer to access your camera to scan VIN barcodes."
- **Notifications:** Only used when push feature flag is enabled (currently off). No permission prompt when disabled.

## Assets

- **App icon / splash:** Configure in app.json under `expo.icon` and `expo.splash` if you have assets. Placeholders or defaults are fine for preview builds.
- **iOS:** Ensure icon and splash paths exist or use Expo defaults.

## Push notifications (optional, currently disabled)

Push is off by default (`ENABLE_PUSH_NOTIFICATIONS = false` in `src/config/features.ts`). When you enable it:

1. Install: `npx expo install expo-notifications`
2. Add EAS project ID to app config if using Expo push (e.g. `extra.eas.projectId`).
3. Backend: implement device token storage (e.g. POST /api/me/device-tokens) and send notifications via Expo push API.

Builds do **not** require push credentials when the feature is disabled.

## Troubleshooting

- **Build fails with "project not linked":** Run `eas init` in apps/mobile and follow prompts.
- **iOS build fails (signing):** Configure credentials in Expo dashboard or run `eas credentials` and set up distribution cert / provisioning profile.
- **App runs in dev but not after build:** Ensure env/API URL is set for the build (EAS secrets or build env).
