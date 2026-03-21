import { pollPendingDonations } from "../routes/donations.js";

export function startPoller(intervalMs = 2 * 60 * 1000): void {
  // Run once 10 s after startup, then every intervalMs
  setTimeout(() => pollPendingDonations().catch(console.error), 10_000);
  setInterval(() => pollPendingDonations().catch(console.error), intervalMs);
  console.log(`[poller] Started — polling every ${intervalMs / 1000}s`);
}
