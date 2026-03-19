import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  await s3.send(cmd);
  const base = PUBLIC_URL.replace(/\/$/, "");
  return `${base}/${key}`;
}

export function getMediaContentType(mediaType: string): string {
  const map: Record<string, string> = {
    photo: "image/jpeg",
    video: "video/mp4",
    document: "application/octet-stream",
    voice: "audio/ogg",
    audio: "audio/mpeg",
  };
  return map[mediaType] ?? "application/octet-stream";
}
