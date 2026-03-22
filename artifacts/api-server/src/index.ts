import app from "./app";
import { initSchema } from "./lib/d1.js";
import { tgCall, setMyCommands, deleteMyCommands, setMyDescription, setMyShortDescription } from "./lib/telegram.js";
import { startPoller } from "./lib/poller.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Production webhook always points to the custom domain so the deployed server
// receives Telegram updates regardless of which environment last started.
const PRODUCTION_WEBHOOK = "https://mini.susagar.sbs/api/webhook";

async function autoSetupWebhook() {
  if (!process.env.BOT_TOKEN) return;

  try {
    await tgCall("setWebhook", {
      url: PRODUCTION_WEBHOOK,
      allowed_updates: ["message", "callback_query", "pre_checkout_query", "my_chat_member", "chat_member"],
    });
    console.log(`Webhook registered: ${PRODUCTION_WEBHOOK}`);
  } catch (err) {
    console.error("Failed to register webhook:", err);
  }
}

async function autoSetupBotMenu() {
  if (!process.env.BOT_TOKEN) return;

  try {
    // Clear all command scopes so stale commands from previous deployments are wiped
    const scopesToClear = [
      undefined,
      { type: "all_private_chats" },
      { type: "all_group_chats" },
      { type: "all_chat_administrators" },
    ];
    await Promise.allSettled(scopesToClear.map(scope => deleteMyCommands(scope)));

    const commands = [
      { command: "start",   description: "Open the bot and mini app" },
      { command: "donate",  description: "Make a donation (crypto or Stars)" },
      { command: "history", description: "View your donation history" },
      { command: "help",    description: "Get help and contact info" },
      { command: "tagall",  description: "Tag all members in this group (premium feature)" },
      { command: "banall",  description: "Ban all tracked members in this group (premium feature)" },
    ];
    await Promise.all([
      setMyCommands(commands),
      setMyDescription("Contact the admin, donate crypto, or donate Telegram Stars."),
      setMyShortDescription("Contact admin & donations"),
    ]);
    console.log("Bot commands and description set");
  } catch (err) {
    console.error("Failed to set bot commands:", err);
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
  await autoSetupBotMenu();
  startPoller(2 * 60 * 1000);
});
