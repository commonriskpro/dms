/**
 * Demo pipeline — generate voiceover from script.
 * Uses ElevenLabs API if ELEVENLABS_API_KEY is set; otherwise falls back to system TTS (say on macOS).
 * Writes demo-output/voiceover.mp3.
 */

import path from "path";
import fs from "fs";
import { execSync } from "child_process";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const SCRIPT_PATH = path.join(OUT_DIR, "script.txt");
const VOICEOVER_PATH = path.join(OUT_DIR, "voiceover.mp3");

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? "";
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM"; // Rachel

async function fetchWithTimeout(
  url: string,
  opts: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 30000, ...rest } = opts;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

/** Generate MP3 via ElevenLabs text-to-speech. */
async function generateWithElevenLabs(text: string): Promise<Buffer> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_monolingual_v1",
    }),
    timeout: 60000,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs API error ${res.status}: ${err}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** Fallback: system TTS (macOS "say" → aiff, then convert to mp3 if ffmpeg available). */
function generateWithSystemTTS(text: string): void {
  const aiffPath = path.join(OUT_DIR, "voiceover.aiff");
  try {
    execSync(`say -o "${aiffPath}" "${text.replace(/"/g, '\\"')}"`, {
      stdio: "inherit",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    console.warn("[generate-voiceover] 'say' failed; ensure script.txt exists and run on macOS or install a TTS fallback.");
    if (fs.existsSync(aiffPath)) fs.unlinkSync(aiffPath);
    throw new Error("System TTS failed. Set ELEVENLABS_API_KEY for cloud voiceover.");
  }
  try {
    execSync(
      `ffmpeg -y -i "${aiffPath}" -acodec libmp3lame -q:a 2 "${VOICEOVER_PATH}"`,
      { stdio: "inherit" }
    );
  } catch {
    fs.renameSync(aiffPath, VOICEOVER_PATH.replace(".mp3", ".aiff"));
    console.warn("[generate-voiceover] ffmpeg not found; saved as voiceover.aiff. Install ffmpeg for MP3.");
    return;
  }
  if (fs.existsSync(aiffPath)) fs.unlinkSync(aiffPath);
}

export async function runGenerateVoiceover(): Promise<void> {
  if (!fs.existsSync(SCRIPT_PATH)) {
    throw new Error(`Script not found: ${SCRIPT_PATH}. Run generate-script first.`);
  }
  const text = fs.readFileSync(SCRIPT_PATH, "utf-8").trim();
  if (!text) throw new Error("Script is empty.");

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  if (ELEVENLABS_API_KEY) {
    console.log("[generate-voiceover] Using ElevenLabs API...");
    try {
      const audio = await generateWithElevenLabs(text);
      fs.writeFileSync(VOICEOVER_PATH, audio);
      console.log("[generate-voiceover] Wrote", VOICEOVER_PATH);
    } catch (e) {
      console.warn("[generate-voiceover] ElevenLabs failed:", e);
      console.log("[generate-voiceover] Falling back to system TTS...");
      generateWithSystemTTS(text);
    }
  } else {
    console.log("[generate-voiceover] No ELEVENLABS_API_KEY; using system TTS (macOS 'say')...");
    generateWithSystemTTS(text);
    if (fs.existsSync(VOICEOVER_PATH)) {
      console.log("[generate-voiceover] Wrote", VOICEOVER_PATH);
    }
  }
}

async function main() {
  try {
    await runGenerateVoiceover();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
