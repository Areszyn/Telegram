/**
 * FFmpeg utilities: codec detection, MKV→MP4 conversion, disk cleanup.
 * Downloads large files via MTProto (no 20 MB Bot API limit).
 */
import { spawn }                   from "child_process";
import { createWriteStream, unlinkSync, statSync, mkdirSync, existsSync } from "fs";
import { readdir }                 from "fs/promises";
import { join }                    from "path";
import { getMtClient, Api }        from "./mtproto.js";
// @ts-ignore
import bigInt                      from "big-integer";

export const TMP_DIR = "/tmp/tg_videos";
mkdirSync(TMP_DIR, { recursive: true });

// ── Path helpers ─────────────────────────────────────────────────────────────

export function rawPath(uid: string, ext = "mkv"): string {
  return join(TMP_DIR, `${uid}_raw.${ext}`);
}
export function mp4Path(uid: string): string {
  return join(TMP_DIR, `${uid}.mp4`);
}

// ── ffprobe ───────────────────────────────────────────────────────────────────

export interface ProbeResult {
  videoCodec: string;
  container:  string;
  needsConv:  boolean;
}

export async function probeFile(filePath: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", [
      "-v", "quiet", "-print_format", "json",
      "-show_streams", "-show_format", filePath,
    ]);
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", code => {
      if (code !== 0) { reject(new Error("ffprobe failed")); return; }
      try {
        const info = JSON.parse(out) as {
          streams?: Array<{ codec_type?: string; codec_name?: string }>;
          format?:  { format_name?: string };
        };
        const vs         = info.streams?.find(s => s.codec_type === "video");
        const videoCodec = vs?.codec_name ?? "unknown";
        const container  = info.format?.format_name ?? "";
        const needsConv  =
          videoCodec === "hevc" ||
          container.includes("matroska") ||
          container.includes("webm");
        resolve({ videoCodec, container, needsConv });
      } catch (e) { reject(e); }
    });
    proc.stderr.on("data", () => {});
  });
}

// ── Download via MTProto to disk ──────────────────────────────────────────────

export async function downloadViaMtProto(
  chatId:   number,
  msgId:    number,
  destPath: string,
): Promise<void> {
  const client = await getMtClient();

  const peer = new Api.InputPeerUser({
    userId:     bigInt(String(chatId)),
    accessHash: bigInt(0),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await client.invoke(new Api.messages.GetHistory({
    peer,
    offsetId:   msgId + 1,
    addOffset:  0,
    limit:      1,
    maxId:      msgId + 1,
    minId:      0,
    hash:       bigInt(0),
    offsetDate: 0,
  }));

  const tgMsg = (result?.messages as Api.TypeMessage[] | undefined)
    ?.find((m): m is Api.Message => m instanceof Api.Message && m.id === msgId);

  if (!tgMsg || !(tgMsg.media instanceof Api.MessageMediaDocument)) {
    throw new Error(`Message ${msgId} not found or has no document`);
  }
  const candidate = tgMsg.media.document;
  if (!(candidate instanceof Api.Document)) {
    throw new Error("Media is not a Document");
  }

  const location = new Api.InputDocumentFileLocation({
    id:            candidate.id,
    accessHash:    candidate.accessHash,
    fileReference: candidate.fileReference,
    thumbSize:     "",
  });

  const ws = createWriteStream(destPath);
  let written = 0;

  for await (const chunk of client.iterDownload({
    file:        location,
    offset:      BigInt(0),
    requestSize: 512 * 1024,
  })) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    written += buf.length;
    await new Promise<void>((res, rej) => {
      if (!ws.write(buf)) ws.once("drain", res);
      else res();
      ws.once("error", rej);
    });
  }

  await new Promise<void>((res, rej) => {
    ws.end();
    ws.once("finish", res);
    ws.once("error", rej);
  });

  console.log(`[ffmpeg] downloaded ${written} bytes → ${destPath}`);
}

// ── FFmpeg conversion ─────────────────────────────────────────────────────────

export async function convertToMp4(
  inputPath:  string,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-y", "-i", inputPath,
      "-map", "0:v",
      "-map", "0:a?",
      "-map", "0:s?",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-c:a", "aac", "-b:a", "192k",
      "-c:s", "mov_text",
      "-movflags", "+faststart",
      outputPath,
    ];
    console.log(`[ffmpeg] converting ${inputPath} → ${outputPath}`);
    const proc = spawn("ffmpeg", args);
    let errLog = "";
    proc.stderr.on("data", (d: Buffer) => { errLog += d.toString(); });
    proc.on("close", code => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited ${code}: ${errLog.slice(-500)}`));
      } else {
        console.log(`[ffmpeg] done → ${outputPath}`);
        resolve();
      }
    });
  });
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
