/**
 * AI demo pipeline — convert script to narration audio.
 * Uses ElevenLabs if ELEVENLABS_API_KEY exists; fallback to system TTS.
 * Output: /demo-output/voiceover.mp3. Fails gracefully if external API unavailable.
 */

import path from "path";
import fs from "fs";
import { execSync } from "child_process";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const SCRIPT_PATH = path.join(OUT_DIR, "script.txt");
const VOICEOVER_PATH = path.join(OUT_DIR, "voiceover.mp3");
const VOICEOVER_AIFF = path.join(OUT_DIR, "voiceover.aiff");

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? "";
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

async function generateWithElevenLabs(text: string): Promise<Buffer> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({ text, model_id: "eleven_monolingual_v1" }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

function generateWithSystemTTS(text: string): void {
  const aiffPath = VOICEOVER_AIFF;
  try {
    execSync(`say -o "${aiffPath}" "${text.replace(/"/g, '\\"')}"`, {
      stdio: "inherit",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    if (fs.existsSync(aiffPath)) fs.unlinkSync(aiffPath);
    throw new Error("System TTS failed. Set ELEVENLABS_API_KEY for cloud voiceover.");
  }
  try {
    execSync(`ffmpeg -y -i "${aiffPath}" -acodec libmp3lame -q:a 2 "${VOICEOVER_PATH}"`, { stdio: "inherit" });
  } catch {
    fs.renameSync(aiffPath, VOICEOVER_PATH.replace(".mp3", ".aiff"));
    return;
  }
  if (fs.existsSync(aiffPath)) fs.unlinkSync(aiffPath);
}

export async function runGenerateVoiceover(): Promise<void> {
  if (!fs.existsSync(SCRIPT_PATH)) throw new Error(`Script not found: ${SCRIPT_PATH}. Run generate-script first.`);
  const text = fs.readFileSync(SCRIPT_PATH, "utf-8").trim();
  if (!text) throw new Error("Script is empty.");

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  if (ELEVENLABS_API_KEY) {
    try {
      const audio = await generateWithElevenLabs(text);
      fs.writeFileSync(VOICEOVER_PATH, audio);
      console.log("[generate-voiceover] Wrote", VOICEOVER_PATH);
    } catch (e) {
      console.warn("[generate-voiceover] ElevenLabs failed:", e);
      console.log("[generate-voiceover] Falling back to system TTS...");
      generateWithSystemTTS(text);
      if (fs.existsSync(VOICEOVER_PATH)) console.log("[generate-voiceover] Wrote", VOICEOVER_PATH);
    }
  } else {
    console.log("[generate-voiceover] No ELEVENLABS_API_KEY; using system TTS (macOS say)...");
    generateWithSystemTTS(text);
    if (fs.existsSync(VOICEOVER_PATH)) console.log("[generate-voiceover] Wrote", VOICEOVER_PATH);
  }
}

function main() {
  runGenerateVoiceover().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
main();
