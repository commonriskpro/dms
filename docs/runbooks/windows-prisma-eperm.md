# Windows: Fix Prisma EPERM / Engine Lock During npm ci

When `npm ci` fails on Windows with:

```
EPERM: operation not permitted, unlink '...\node_modules\@prisma\.engines-...\query_engine-windows.dll.node'
```

the Prisma engine binary is locked by another process (Node, IDE, antivirus, or a previous install).

---

## Exact steps (run from repo root)

1. **Close dev servers and tools**
   - Stop any `npm run dev:dealer`, `npm run dev:platform`, or other Node dev processes.
   - Close VS Code / Cursor if it’s running TypeScript or Prisma in the background (e.g. Prisma extension).

2. **Kill Node processes (optional helper)**
   ```bash
   npm run kill:node:win
   ```
   Or manually:
   ```bash
   taskkill /F /IM node.exe /IM npm.exe /IM npx.exe
   ```
   Use Task Manager if needed to end any remaining `node.exe` / `npm.exe` / `npx.exe`.

3. **Remove install artifacts**
   - Delete the repository **root** `node_modules` folder.
   - Optionally use the helper (after killing Node):
     ```bash
     npm run clean:win
     ```
   - Delete Prisma engine caches so they can be re-downloaded:
     - `%LOCALAPPDATA%\Temp\prisma-*` (or `$env:LOCALAPPDATA\Temp\prisma-*` in PowerShell)
     - Any `node_modules\.prisma` or `node_modules\@prisma\.engines-*` under the repo if they still exist after deleting `node_modules`.

4. **Reinstall from repo root**
   ```bash
   npm ci
   ```
   All installs must be run from the **repository root** only. Do not run `npm install` or `npm ci` inside `apps/*` or `packages/*`.

5. **If it still fails**
   - Add an **antivirus exclusion** for:
     - The repo directory (e.g. `C:\dev\dms`).
     - `%LOCALAPPDATA%\Temp` (Prisma downloads).
   - Run the terminal as **Administrator** only if you’ve confirmed it’s a permissions issue (e.g. corporate policy), not as a default.

---

## Root scripts (no new deps)

- **`npm run kill:node:win`** — Force-kill `node.exe`, `npm.exe`, `npx.exe` (Windows). Safe to run; ignores “not found”.
- **`npm run clean:win`** — Runs `kill:node:win` then removes root `node_modules`. Use before a clean `npm ci`.

These are in the root `package.json`; no Prisma or app behavior is changed.
