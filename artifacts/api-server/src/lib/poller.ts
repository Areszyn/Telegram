import { d1All, d1Run } from "./d1.js";

const OXAPAY_BASE = "https://api.oxapay.com";
const MERCHANT_KEY = () => process.env.OXAPAY_MERCHANT_KEY!;

function normalizeStatus(raw: string): string {
  const map: Record<string, string> = {
    waiting:    "pending",
    paid:       "paid",
    confirming: "confirming",
    expired:    "expired",
    failed:     "failed",
    refunded:   "failed",
  };
  return map[raw.toLowerCase()] ?? raw.toLowerCase();
}

async function oxaInquiry(trackId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${OXAPAY_BASE}/merchants/inquiry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ merchant: MERCHANT_KEY(), trackId }),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

export async function pollPendingDonations(): Promise<void> {
  const pending = await d1All<{ id: number; track_id: string; status: string }>(
    `SELECT id, track_id, status FROM donations
     WHERE status IN ('pending', 'confirming')
       AND track_id IS NOT NULL
       AND created_at < datetime('now', '-2 minutes')
     LIMIT 30`
  );

  if (!pending.length) return;
  console.log(`[poller] Checking ${pending.length} pending donation(s)…`);

  for (const d of pending) {
    try {
      const data = await oxaInquiry(d.track_id);
      const result    = data.result as number;
      const rawStatus = data.status as string | undefined;

      if (result === 100 && rawStatus) {
        const normalized = normalizeStatus(rawStatus);
        const txId       = data.txId as string | undefined;

        if (normalized !== d.status) {
          await d1Run(
            "UPDATE donations SET status = ?, tx_id = COALESCE(?, tx_id) WHERE track_id = ?",
            [normalized, txId ?? null, d.track_id]
          );
          console.log(`[poller] ${d.track_id}: ${d.status} → ${normalized}${txId ? ` txId=${txId}` : ""}`);
        }
      } else {
        console.warn(`[poller] ${d.track_id}: OxaPay result=${result} status=${rawStatus ?? "none"}`);
      }
    } catch (err) {
      console.error(`[poller] Error for track_id=${d.track_id}:`, err);
    }
  }
}

export function startPoller(intervalMs = 2 * 60 * 1000): void {
  // Run once 10 s after startup, then every intervalMs
  setTimeout(() => pollPendingDonations().catch(console.error), 10_000);
  setInterval(() => pollPendingDonations().catch(console.error), intervalMs);
  console.log(`[poller] Started — polling every ${intervalMs / 1000}s`);
}
