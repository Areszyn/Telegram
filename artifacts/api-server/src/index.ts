import app from "./app";
import { initSchema } from "./lib/d1.js";
import { tgCall } from "./lib/telegram.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function autoSetupWebhook() {
  const allDomains = (process.env.REPLIT_DOMAINS ?? "").split(",").map(d => d.trim()).filter(Boolean);
  const prodDomain = allDomains.find(d => d.endsWith(".replit.app"));
  const domain = prodDomain ?? process.env.REPLIT_DEV_DOMAIN;
  if (!domain || !process.env.BOT_TOKEN) return;
  const webhookUrl = `https://${domain}/api/webhook`;
  try {
    await tgCall("setWebhook", {
      url: webhookUrl,
      allowed_updates: ["message", "callback_query"],
    });
    console.log(`Webhook registered: ${webhookUrl}`);
  } catch (err) {
    console.error("Failed to register webhook:", err);
  }
}

async function autoInitDb() {
  try {
    await initSchema();
    console.log("D1 schema ready");
  } catch (err) {
    console.error("D1 init failed:", err);
  }
}

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);
  await autoInitDb();
  await autoSetupWebhook();
});
