# Demo pipeline

Generates a polished product demo video from a single command.

## Prepare local stage (first time)

From repo root, run once to set up DB, seed data, demo user, and Playwright:

```bash
npm run prepare-demo
```

This will:

1. Create `.env.local` from `.env.local.example` if missing (then fill in DATABASE_URL and Supabase keys and run again).
2. Run Prisma generate, DB migrate, and DB seed (permissions + demo dealership).
3. Create the demo login in Supabase and link it to the demo dealership.
4. Install Playwright Chromium.

Ensure `.env.local` has real values for `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and optionally `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` (defaults in example: `demo@example.com` / `DemoPassword123!`).

## Usage

From repo root:

```bash
npm run generate-demo
```

Output: `demo-output/product-demo.mp4`

## Prerequisites (after prepare-demo)

- **Database**: `.env.local` with `DATABASE_URL`; `prepare-demo` runs migrate and seed.
- **Login**: `DEMO_USER_EMAIL` and `DEMO_USER_PASSWORD` in `.env.local` (created by `prepare-demo` from example).
- **FFmpeg**: System `ffmpeg` or the `ffmpeg-static` devDependency for the final render.
- **Playwright**: Installed by `prepare-demo`; otherwise run `npx playwright install chromium` once.

## Steps (automatic)

1. **prisma generate** (dealer)
2. **seed-demo** – Idempotent demo data (vehicles, leads, deals)
3. **Launch app** – Starts dealer dev server and waits for readiness
4. **run-walkthrough** – Playwright navigates dashboard → inventory → add vehicle → CRM → deals → delivery; records `raw-demo.webm`
5. **generate-script** – Writes narration text to `script.txt`
6. **generate-voiceover** – ElevenLabs (if `ELEVENLABS_API_KEY` set) or system TTS → `voiceover.mp3`
7. **render-video** – FFmpeg combines video + audio → `product-demo.mp4`

## Env (optional)

- `DEMO_BASE_URL` – App URL (default `http://localhost:3000`)
- `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` – For walkthrough login
- `ELEVENLABS_API_KEY` – For AI voiceover; omit to use system TTS (e.g. macOS `say`)
- `ELEVENLABS_VOICE_ID` – Voice ID (default Rachel)

## Output layout

```
demo-output/
  raw-demo.webm
  script.txt
  voiceover.mp3   (or voiceover.aiff if no ffmpeg on TTS path)
  product-demo.mp4
```
