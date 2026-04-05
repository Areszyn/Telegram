import "dotenv/config";
import { serve } from "@hono/node-server";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = path.resolve(__dirname, "../.wrangler/state/v3/d1/miniflare-D1DatabaseObject");
fs.mkdirSync(dbPath, { recursive: true });
const db = new Database(path.join(dbPath, "db.sqlite"));

function makeD1(sqliteDb: Database.Database) {
  function prepare(sql: string) {
    return {
      _sql: sql,
      bind(...params: unknown[]) {
        const self = this as any;
        self._params = params;
        return self;
      },
      async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
        const stmt = sqliteDb.prepare((this as any)._sql);
        const results = stmt.all(...((this as any)._params ?? [])) as T[];
        return { results };
      },
      async first<T = Record<string, unknown>>(): Promise<T | null> {
        const stmt = sqliteDb.prepare((this as any)._sql);
        const row = stmt.get(...((this as any)._params ?? [])) as T | undefined;
        return row ?? null;
      },
      async run(): Promise<{ success: boolean; results?: unknown[] }> {
        try {
          const stmt = sqliteDb.prepare((this as any)._sql);
          stmt.run(...((this as any)._params ?? []));
          return { success: true };
        } catch (e: unknown) {
          const msg = String(e);
          if (msg.includes("already exists") || msg.includes("duplicate column")) {
            return { success: true };
          }
          throw e;
        }
      },
    };
  }
  return { prepare };
}

function makeFakeR2() {
  const store = new Map<string, { data: ArrayBuffer; metadata: Record<string, string> }>();
  return {
    async put(key: string, value: ArrayBuffer | string | ReadableStream, options?: { httpMetadata?: Record<string, string> }) {
      let data: ArrayBuffer;
      if (typeof value === "string") {
        data = Buffer.from(value).buffer;
      } else if (value instanceof ArrayBuffer) {
        data = value;
      } else {
        const reader = (value as ReadableStream).getReader();
        const chunks: Uint8Array[] = [];
        let done = false;
        while (!done) {
          const result = await reader.read();
          if (result.done) { done = true; } else { chunks.push(result.value); }
        }
        const total = chunks.reduce((acc, c) => acc + c.length, 0);
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
        data = merged.buffer;
      }
      store.set(key, { data, metadata: options?.httpMetadata ?? {} });
      return { key, size: data.byteLength };
    },
    async get(key: string) {
      const item = store.get(key);
      if (!item) return null;
      return {
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(item.data));
            controller.close();
          },
        }),
        arrayBuffer: async () => item.data,
        text: async () => Buffer.from(item.data).toString("utf-8"),
        json: async () => JSON.parse(Buffer.from(item.data).toString("utf-8")),
        httpMetadata: item.metadata,
        size: item.data.byteLength,
      };
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list(options?: { prefix?: string; limit?: number }) {
      const prefix = options?.prefix ?? "";
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix));
      return {
        objects: keys.map((k) => ({ key: k, size: store.get(k)!.data.byteLength })),
        truncated: false,
      };
    },
  };
}

async function main() {
  const { default: worker } = await import("./index.ts");
  const PORT = parseInt(process.env.PORT ?? "8080", 10);

  const d1 = makeD1(db);
  const r2 = makeFakeR2();

  const env = {
    DB: d1,
    BUCKET: r2,
    BOT_TOKEN: process.env.BOT_TOKEN ?? "",
    ADMIN_ID: process.env.ADMIN_ID ?? "",
    OXAPAY_MERCHANT_KEY: process.env.OXAPAY_MERCHANT_KEY ?? "",
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL ?? "",
    TELEGRAM_API_ID: process.env.TELEGRAM_API_ID ?? "",
    TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH ?? "",
    MTPROTO_BACKEND_URL: process.env.MTPROTO_BACKEND_URL ?? "http://localhost:3003",
    MTPROTO_API_KEY: process.env.MTPROTO_API_KEY ?? "",
    APP_DOMAIN: process.env.APP_DOMAIN ?? `localhost:${PORT}`,
    MINIAPP_URL: process.env.MINIAPP_URL ?? "http://localhost:3000/miniapp/",
    PAGES_ORIGIN: process.env.PAGES_ORIGIN ?? "http://localhost:3000",
    AI_KEY_ENCRYPTION_SECRET: process.env.AI_KEY_ENCRYPTION_SECRET ?? "dev-secret-32-chars-minimum-here",
  };

  serve(
    {
      fetch: (req: Request) => (worker as any).fetch(req, env, {}),
      port: PORT,
      hostname: "0.0.0.0",
    },
    (info) => {
      console.log(`[dev-server] API ready on http://0.0.0.0:${info.port}`);
    },
  );
}

main().catch((e) => {
  console.error("[dev-server] Fatal:", e);
  process.exit(1);
});
