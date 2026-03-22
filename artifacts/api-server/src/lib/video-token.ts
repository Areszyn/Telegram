export interface VideoTokenPayload {
  fid:    string;
  uid:    string;
  exp:    number;
  mime?:  string;
  name?:  string;
  size?:  number;
  amsgId?: number;
  acid?:  number;
}

export const VIDEO_TTL_MS = 24 * 60 * 60 * 1000;

function base64urlEncode(buf: Uint8Array): string {
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signToken(
  payload: VideoTokenPayload,
  secret: string,
): Promise<string> {
  const data = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${data}.${base64urlEncode(new Uint8Array(sig))}`;
}

export async function verifyToken(
  token: string,
  secret: string,
): Promise<VideoTokenPayload | null> {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const data = token.slice(0, dot);
  const sig  = token.slice(dot + 1);
  try {
    const key = await importKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlDecode(sig),
      new TextEncoder().encode(data),
    );
    if (!valid) return null;
    const payload = JSON.parse(
      new TextDecoder().decode(base64urlDecode(data)),
    ) as VideoTokenPayload;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
