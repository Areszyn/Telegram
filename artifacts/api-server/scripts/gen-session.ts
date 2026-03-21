/**
 * Run once to generate a Telegram StringSession.
 *
 *   TELEGRAM_API_ID=123456 TELEGRAM_API_HASH=abc... npx tsx scripts/gen-session.ts
 *
 * Follow the prompts — it will print the session string to copy into the secret.
 */
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import * as readline from "readline";

const apiId   = parseInt(process.env.TELEGRAM_API_ID ?? "0",  10);
const apiHash = process.env.TELEGRAM_API_HASH ?? "";

if (!apiId || !apiHash) {
  console.error("Set TELEGRAM_API_ID and TELEGRAM_API_HASH before running.");
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> => new Promise(r => rl.question(q, r));

const client = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 3 });

await client.start({
  phoneNumber:      async () => ask("Phone number (with country code): "),
  password:         async () => ask("2FA password (leave blank if none): "),
  phoneCode:        async () => ask("Telegram code: "),
  onError: (err)  => console.error(err),
});

const session = client.session.save() as unknown as string;
console.log("\n✅ Your session string (add as TELEGRAM_SESSION secret):\n");
console.log(session);
console.log();

rl.close();
await client.disconnect();
process.exit(0);
