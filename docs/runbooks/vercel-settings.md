# Vercel project settings

Use two separate Vercel projects (Dealer and Platform), both linked to the same repository.

**Recommended: symmetric setup (output from repo files for both)**  
Set each project’s **Root Directory** to its app (`apps/dealer` / `apps/platform`). Each app has a `vercel.json` with `outputDirectory: ".next"`, so you don’t need to set Output in the UI. Use the install/build commands below so the monorepo (e.g. `@dms/contracts`) is available.

**Alternative: build from repo root**  
Leave Root Directory empty for both and use the dispatcher (`npm run build`). The root `vercel.json` sets `outputDirectory: "apps/dealer/.next"`, so **dms** works without any Output override. For **platform-admin** you must set **Output Directory** in Vercel UI to **`apps/platform/.next`** (overrides the root file).

---

## Environment variables (required for client API calls)

**Platform app:** For the browser to send API requests to your deployment (not localhost), set in Vercel → Settings → Environment Variables:

| Variable | Required for | Example (Platform) |
|----------|----------------|--------------------|
| `NEXT_PUBLIC_APP_URL` | Yes | `https://platform-admin-blond-alpha.vercel.app` (your actual deployment URL, no trailing slash) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | From Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | From Supabase API → anon key |

If `NEXT_PUBLIC_APP_URL` is missing or wrong, the client may fail to build the request URL and you’ll see “Network error. Please retry” with no request in the Network tab. Set it to the **exact** URL users use (e.g. your Vercel deployment URL). Full list: [env-reference.md](./env-reference.md).

---

## Dealer project (Vercel project name: **dms**)

| Setting | Value |
|--------|--------|
| **Framework Preset** | **Other** (required). If set to Next.js, Vercel runs framework detection and can fail. |
| **Output Directory** | Leave empty when using Root = `apps/dealer` (uses `apps/dealer/vercel.json` → `.next`). When Root = empty, set to **`apps/dealer/.next`** in the UI. |

Use **one** of these two configurations:

| Root Directory | Install Command | Build Command | Output (if not from file) |
|----------------|-----------------|---------------|----------------------------|
| **`apps/dealer`** (recommended) | `cd ../.. && npm install` | `cd ../.. && npm run vercel-build:dealer` | `.next` (from app `vercel.json`) |
| *(empty – repo root)* | `npm install` | `npm run build` | **`apps/dealer/.next`** (from root `vercel.json`; leave UI empty) |

Node version: 20.x (Vercel → Settings → General → Node.js Version if needed).

---

## Platform project (Vercel project name: **platform-admin**)

| Setting | Value |
|--------|--------|
| **Framework Preset** | **Other** (required). Same reason as dealer. |
| **Output Directory** | Leave empty when using Root = `apps/platform` (uses `apps/platform/vercel.json` → `.next`). When Root = empty, set to **`apps/platform/.next`** in the UI. |

Use **one** of these two configurations:

| Root Directory | Install Command | Build Command | Output (if not from file) |
|----------------|-----------------|---------------|----------------------------|
| **`apps/platform`** (recommended) | `cd ../.. && npm install` | `cd ../.. && npm run vercel-build:platform` | `.next` (from app `vercel.json`) |
| *(empty – repo root)* | `npm install` | `npm run build` | **`apps/platform/.next`** (set in UI) |

**Important:** Do **not** set Output to `apps/dealer/.next` for the platform project.

### Quick deploy checklist (both apps)

| Check | dms (dealer) | platform-admin |
|-------|----------------|----------------|
| Framework Preset | **Other** | **Other** |
| Root Directory | empty **or** `apps/dealer` | empty **or** `apps/platform` |
| Build Command | `npm run build` (root) **or** `cd ../.. && npm run vercel-build:dealer` (app root) | `npm run build` (root) **or** `cd ../.. && npm run vercel-build:platform` (app root) |
| Output Directory | **leave empty** (root or app vercel.json) | **leave empty** if Root = `apps/platform`; if Root = empty set **`apps/platform/.next`** |
| After deploy | In build logs: `[vercel-build] output-verify` should show `exists: true` for `apps/dealer/.next` | In build logs: `[vercel-build] output-verify` should show `exists: true` for `apps/platform/.next` |

---

## Build reliability

- **Dispatcher:** When Root is empty, `npm run build` runs `scripts/vercel-build.js`, which uses `VERCEL_PROJECT_NAME` to run `vercel-build:dealer` or `vercel-build:platform`.
- **Symmetric (app as Root):** When Root is `apps/dealer` or `apps/platform`, set Install and Build to run from repo root (`cd ../.. && ...`) so the monorepo and `@dms/contracts` are available. Each app’s `vercel.json` sets `outputDirectory: ".next"`, so no Output Directory is needed in the UI.
- **Root build:** Root `vercel.json` sets `outputDirectory: "apps/dealer/.next"` (for **dms** when Root is empty). For **platform-admin** with Root empty, set Output in Vercel UI to **`apps/platform/.next`**.
- Both apps have their own `package-lock.json`; the root build scripts run `npm ci` in the app dir.
- If you see "cannot find module '@dms/contracts'", ensure the full monorepo is in context (install/build from repo root).
- No cross-imports between apps; shared code is in `packages/contracts` only.

## Debugging builds

- In Vercel build logs, look for lines starting with **`[vercel-build]`**. They show:
  - **`start`**: `cwd`, `VERCEL_PROJECT_NAME`, `VERCEL_ROOT_DIRECTORY`, that the script is running.
  - **`output-check`**: `project`, `expectedOutputDir`, and a `note` for what to set in Vercel UI (dms vs platform-admin).
  - **`running script`**: which npm script and expected output path.
  - **`done`**: success.
  - **`output-verify`**: after build, whether `expectedOutputDir` exists (`exists: true/false`), and `deployCheck` (OK vs "MISSING – 404 likely").
  - **`error`**: script name, message, exit status.
- **If `output-verify` shows `exists: false`:** The build wrote output elsewhere or failed. Check Root Directory and Output Directory in Vercel so they match the table above; redeploy.
- If the build fails before any `[vercel-build]` line (e.g. "No Next.js version detected"), Vercel is using the Next.js framework path instead of our build command. **Set Framework Preset to Other** for both projects, then set Build Command to `npm run build`. Root Directory must be empty.
- If `VERCEL_PROJECT_NAME` is missing or wrong, the dispatcher defaults to the dealer build.

---

## Troubleshooting

| Symptom | Cause | Fix |
|--------|--------|-----|
| **404 NOT_FOUND** on dealer URL (e.g. dms.goldvercel.app) even though build succeeded | Output Directory is wrong for the chosen Root. | **dms** with Root = **empty**: leave Output in UI **empty** (root `vercel.json` has `apps/dealer/.next`). **dms** with Root = **`apps/dealer`**: leave Output **empty** (app `vercel.json` has `.next`). If you had Output = `apps/dealer/.next` in UI with Root = `apps/dealer`, clear it and redeploy. |
| **Stuck on platform login** after correct password (Network: `login` 404 or session not seen) | (1) RSC navigation raced with cookie set, or (2) platform Output Directory wrong. | (1) App now uses a full-page redirect after sign-in so the next request sends cookies. Redeploy platform. (2) If `login` still 404s, set platform Output to **`apps/platform/.next`** when Root is empty, or leave Output empty when Root = **`apps/platform`**. |
| **"The Next.js output directory … was not found at …/apps/platform/apps/dealer/.next"** on platform-admin | Platform project has Output set to `apps/dealer/.next` (dealer’s path). | For **platform-admin**: set Output to **`apps/platform/.next`** (Root empty) or **`.next`** (Root = `apps/platform`). Do not use `apps/dealer/.next`. |
