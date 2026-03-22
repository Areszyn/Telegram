export async function uploadToR2(
  bucket: R2Bucket,
  publicUrl: string,
  key: string,
  body: ArrayBuffer | ReadableStream | string,
  contentType: string,
): Promise<string> {
  await bucket.put(key, body, { httpMetadata: { contentType } });
  const base = publicUrl.replace(/\/$/, "");
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
