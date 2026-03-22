/**
 * FFmpeg utilities: MTProto download, disk cleanup.
 */
import { spawn }                   from "child_process";
import { createWriteStream, unlinkSync, statSync, mkdirSync, existsSync } from "fs";
import { readdir }                 from "fs/promises";
import { join }                    from "path";
import { getMtClient, fileIdToLocation, MTPROTO_CHUNK } from "./mtproto.js";

export const TMP_DIR = "/tmp/tg_videos";
mkdirSync(TMP_DIR, { recursive: true });

// ── Path helpers ─────────────────────────────────────────────────────────────

export function rawPath(uid: string, ext = "mkv"): string {
  return join(TMP_DIR, `${uid}_raw.${ext}`);
}

// ── Download via MTProto to disk (uses file_id, no size limit) ───────────────

export async function downloadViaMtProto(
  fileId:   string,
  destPath: string,
): Promise<void> {
  const client = await getMtClient();
  const { location, dcId } = fileIdToLocation(fileId);

  const ws = createWriteStream(destPath);
  let written = 0;
  let writeErr: Error | null = null;
  ws.on("error", (e) => { writeErr = e; });

  for await (const chunk of client.iterDownload({
    file:        location,
    offset:      BigInt(0),
    requestSize: MTPROTO_CHUNK,
    dcId,
  })) {
    if (writeErr) throw writeErr;
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    written += buf.length;
    if (!ws.write(buf)) {
      await new Promise<void>(resolve => ws.once("drain", resolve));
    }
  }

  if (writeErr) throw writeErr;
  await new Promise<void>((res, rej) => {
    ws.end();
    ws.once("finish", res);
    ws.once("error", rej);
  });

  console.log(`[ffmpeg] downloaded ${written} bytes → ${destPath}`);
}

// ── Safe delete helper ────────────────────────────────────────────────────────

export function safeUnlink(p: string): void {
  try { if (existsSync(p)) unlinkSync(p); } catch {}
}

// ── Cleanup tmp files older than 24 h ────────────────────────────────────────

export async function cleanupTmpDir(): Promise<void> {
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const files  = await readdir(TMP_DIR);
    for (const f of files) {
      const fp = join(TMP_DIR, f);
      try {
        const st = statSync(fp);
        if (st.mtimeMs < cutoff) { unlinkSync(fp); console.log(`[ffmpeg] cleaned ${fp}`); }
      } catch {}
    }
  } catch {}
}

// Run cleanup every hour
setInterval(cleanupTmpDir, 60 * 60 * 1000);
cleanupTmpDir().catch(() => {});
