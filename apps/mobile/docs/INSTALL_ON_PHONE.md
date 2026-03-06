# Install the app on your iPhone for testing

Two ways to run the DMS Dealer app on your iPhone:

---

## Option 1: Expo Go (easiest – no Xcode, no EAS login)

1. **On your iPhone:** Install **Expo Go** from the App Store.

2. **On your Mac:** From the repo root:
   ```bash
   cd apps/mobile
   npm run start
   ```
   Or with tunnel (if your phone is on a different network):
   ```bash
   cd apps/mobile
   npm run start:tunnel
   ```

3. **Connect the app:**
   - **Same Wi‑Fi:** In the terminal you’ll see a QR code. Open the **Camera** app on your iPhone and scan it. Tap the banner to open the project in Expo Go.
   - **Tunnel:** If you used `npm run start:tunnel`, scan the QR code shown for the tunnel URL; Expo Go will load the app through the tunnel.

4. The app will load in Expo Go. Sign in and use it like the web app (ensure the dealer API and Supabase are reachable; see `.env` / `EXPO_PUBLIC_*`).

---

## Option C: Build and install on device (standalone app)

Use this to install a real app on your iPhone (no Expo Go). Requires a Mac.

### 1. Prerequisites

- **Mac** with **Xcode** installed (from the Mac App Store). Open Xcode once and accept the license if prompted.
- **Apple ID** (your normal Apple account is enough for development).
- **iPhone** with a **USB cable** that can connect to your Mac.
- **Dealer API** running (e.g. `npm run dev:dealer` in another terminal) if the app needs to call your backend.

### 2. Connect the iPhone

- Plug the iPhone into the Mac with the cable.
- On the iPhone, if you see **“Trust This Computer?”**, tap **Trust** and enter your passcode.
- Unlock the iPhone and leave it unlocked for the first install (iOS may ask to trust the developer).

### 3. Run the build and install

From the **repo root** (or from `apps/mobile`):

```bash
cd apps/mobile
npx expo run:ios --device
```

- The first time, Expo may generate the native `ios` project (prebuild). That’s normal.
- When asked **“Select a device”**, choose your **iPhone** (e.g. “iPhone 17 Pro”) and press Enter.
- Xcode will compile and install the app. This can take several minutes the first time.
- When it finishes, the app **DMS Dealer** appears on your iPhone home screen. Open it like any other app.

### 4. If Xcode asks for signing

- If you see **“Signing for DealerDMS requires a development team”** (or similar):
  - In Xcode, open the project: `apps/mobile/ios/` (the `.xcworkspace` file).
  - Select the **DealerDMS** target → **Signing & Capabilities**.
  - Under **Team**, choose your **Apple ID** (or “Add an Account” and sign in with your Apple ID). Xcode will create a free development team if needed.
- Then run again from the terminal:
  ```bash
  cd apps/mobile
  npx expo run:ios --device
  ```

### 5. “Untrusted Developer” on the iPhone

- The first time you open the app, iOS may say the developer is not trusted.
- On the iPhone: **Settings → General → VPN & Device Management** (or **Profiles**).
- Under **Developer App**, tap your Apple ID and choose **Trust**.
- Open the app again.

### 6. API URL for the installed app

- The app reads `EXPO_PUBLIC_DEALER_API_URL` from `apps/mobile/.env` at **build time**.
- If you use `http://localhost:3000`, the **phone** cannot reach it (localhost is the phone itself).
- To test against your Mac’s API, set in `apps/mobile/.env`:
  ```bash
  EXPO_PUBLIC_DEALER_API_URL=http://YOUR_MAC_IP:3000
  ```
  (Find your Mac IP: **System Settings → Network → Wi‑Fi → Details**, or run `ipconfig getifaddr en0` in Terminal.)
- Then run **`npx expo run:ios --device`** again so the new URL is baked into the app.

---

## If `pod install` fails (ReactAppDependencyProvider)

In a monorepo, `pod install` can fail with “Unable to find a specification for ReactAppDependencyProvider”. The mobile app’s `ios/Podfile` sets `EXPO_RN_VERSION_FOR_POD` so ExpoModulesCore matches RN 0.76. If you still see the error after a fresh `npm install`, run:

```bash
cd apps/mobile/ios && pod install
```

Then run `npx expo run:ios --device` from `apps/mobile` again.

## If the dev server won’t start

If you see a Metro or `metro-cache` error when running `npm run start`:

- From repo root run `npm ci` (or `npm install`), then try again from `apps/mobile`.
- If it still fails, try from `apps/mobile`: `npx expo start --clear` to clear the Metro cache.

## API / backend

The app uses `EXPO_PUBLIC_DEALER_API_URL` and Supabase env vars from `apps/mobile/.env`. For the phone to reach your API when using Expo Go on the same Wi‑Fi, the API URL must be your Mac’s LAN IP (e.g. `http://192.168.1.x:3000`), not `localhost`. For tunnel or a deployed API, use that URL in `.env`.
