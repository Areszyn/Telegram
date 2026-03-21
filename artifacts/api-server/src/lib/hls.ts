/**
 * HLS (HTTP Live Streaming) utilities.
 *
 * Converts videos to adaptive HLS (360p / 480p / 720p) using FFmpeg.
 * Segments live at /tmp/streams/{uid}/ and are served by the video router.
 * Streams auto-delete after 24 h via scheduleHlsCleanup().
 */
import { spawn }                                       from "child_process";
import {
  existsSync, mkdirSync, rmSync,
  readdirSync, statSync, writeFileSync,
}                                                       from "fs";
import { join }                                        from "path";

// ── Base directory ────────────────────────────────────────────────────────────

export const HLS_BASE = "/tmp/streams";
mkdirSync(HLS_BASE, { recursive: true });

// ── Path helpers ──────────────────────────────────────────────────────────────

export function hlsDir(uid: string): string {
  return join(HLS_BASE, uid);
}
export function hlsMasterPath(uid: string): string {
  return join(hlsDir(uid), "master.m3u8");
}
export function isHlsReady(uid: string): boolean {
  return existsSync(hlsMasterPath(uid));
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function cleanupHlsDir(uid: string): void {
  const dir = hlsDir(uid);
  try {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    console.log(`[hls] cleaned ${dir}`);
  } catch {}
}

export function scheduleHlsCleanup(uid: string, exp: number): void {
  const delay = Math.max(0, exp - Date.now());
  setTimeout(() => cleanupHlsDir(uid), delay);
}

export async function cleanupOldHlsStreams(): Promise<void> {
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const e of readdirSync(HLS_BASE, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const dir = join(HLS_BASE, e.name);
      try {
        if (statSync(dir).mtimeMs < cutoff) {
          rmSync(dir, { recursive: true, force: true });
          console.log(`[hls] auto-cleaned ${dir}`);
        }
      } catch {}
    }
  } catch {}
}

setInterval(cleanupOldHlsStreams, 60 * 60 * 1000);
cleanupOldHlsStreams().catch(() => {});

// ── Quality ladder ────────────────────────────────────────────────────────────

interface Quality {
  label:      string;
  height:     number;
  vBitrate:   string;
  aBitrate:   string;
  bandwidth:  number;
  resolution: string;
}

const LADDER: Quality[] = [
  { label: "720p",  height: 720,  vBitrate: "2500k", aBitrate: "128k", bandwidth: 2756000,  resolution: "1280x720" },
  { label: "480p",  height: 480,  vBitrate: "1200k", aBitrate: "128k", bandwidth: 1356000,  resolution: "854x480"  },
  { label: "360p",  height: 360,  vBitrate:  "600k", aBitrate:  "96k", bandwidth:  724000,  resolution: "640x360"  },
];

// ── FFmpeg helpers ────────────────────────────────────────────────────────────

async function probeHeight(filePath: string): Promise<number> {
  return new Promise(resolve => {
    const proc = spawn("ffprobe", [
      "-v", "quiet",
      "-select_streams", "v:0",
      "-show_entries", "stream=height",
      "-of", "csv=p=0",
      filePath,
    ]);
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => {
      const h = parseInt(out.trim(), 10);
      resolve(isNaN(h) ? 9999 : h);
    });
    proc.stderr.on("data", () => {});
  });
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[hls] ffmpeg ${args.slice(0, 8).join(" ")} …`);
    const proc = spawn("ffmpeg", args);
    let errLog = "";
    proc.stderr.on("data", (d: Buffer) => { errLog += d.toString(); });
    proc.on("close", code => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited ${code}: ${errLog.slice(-1000)}`));
      } else {
        resolve();
      }
    });
  });
}

// ── Main conversion ───────────────────────────────────────────────────────────

export async function convertToHls(inputPath: string, uid: string): Promise<void> {
  const outDir = hlsDir(uid);
  mkdirSync(outDir, { recursive: true });

  const srcH = await probeHeight(inputPath);
  console.log(`[hls] source height=${srcH} → ${outDir}`);

  // Only generate qualities ≤ source height; always keep at least the lowest.
  const active = LADDER.filter(q => q.height <= srcH);
  const qualities: Quality[] = active.length > 0 ? active : [LADDER[LADDER.length - 1]];

  const args: string[] = ["-y", "-i", inputPath];

  if (qualities.length > 1) {
    const tags   = qualities.map((_, i) => `[v${i}]`).join("");
    const scales = qualities.map((q, i) => `[v${i}]scale=-2:${q.height}[vout${i}]`).join(";");
    args.push("-filter_complex", `[0:v]split=${qualities.length}${tags};${scales}`);
  } else {
    args.push("-vf", `scale=-2:${qualities[0].height}`);
  }

  for (let i = 0; i < qualities.length; i++) {
    const q   = qualities[i];
    const map = qualities.length > 1 ? `[vout${i}]` : "0:v";
    args.push(
      "-map", map,
      "-map", "0:a?",
      `-c:v:${i}`, "libx264", "-preset", "veryfast", "-crf", "23", `-b:v:${i}`, q.vBitrate,
      `-c:a:${i}`, "aac", `-b:a:${i}`, q.aBitrate,
      "-hls_time", "6",
      "-hls_list_size", "0",
      "-hls_segment_filename", join(outDir, `${q.label}_%03d.ts`),
      join(outDir, `${q.label}.m3u8`),
    );
  }

  await runFfmpeg(args);

  // Write master.m3u8
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3", ""];
  for (const q of qualities) {
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${q.bandwidth},RESOLUTION=${q.resolution},NAME="${q.label}"`);
    lines.push(`${q.label}.m3u8`);
    lines.push("");
  }
  writeFileSync(join(outDir, "master.m3u8"), lines.join("\n"), "utf8");
  console.log(`[hls] ready → ${outDir}/master.m3u8 (${qualities.map(q => q.label).join(",")})`);
}
