import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDateIST, relativeTime } from "@/lib/date";

import { API_BASE } from "@/lib/api";

const PRESET_AMOUNTS = [5, 10, 25, 50];

const STATIC_NETWORKS = [
  { id: "TRC20", label: "TRC20", sub: "USDT/TRX" },
  { id: "BEP20", label: "BEP20", sub: "USDT/BNB" },
  { id: "ERC20", label: "ERC20", sub: "USDT/ETH" },
  { id: "BTC",   label: "BTC",   sub: "Bitcoin"  },
  { id: "LTC",   label: "LTC",   sub: "Litecoin" },
  { id: "TON",   label: "TON",   sub: "Toncoin"  },
  { id: "SOL",   label: "SOL",   sub: "Solana"   },
  { id: "DOGE",  label: "DOGE",  sub: "Dogecoin" },
];

type Coin = { symbol: string; networks: string[] };
type StaticAddr = {
  id: number; address: string; network: string;
  qr_code?: string; memo?: string; created_at: string;
};
type Donation = {
  id: number; amount: number; currency: string;
  pay_amount?: number; pay_currency?: string; network?: string;
  address?: string; qr_code?: string; expired_at?: number;
  status: string; track_id?: string; created_at: string;
};
type PaymentData = {
  trackId: string; address: string; payAmount: number; payCurrency: string;
  network: string; qrCode?: string; expiredAt: number; amount: number;
};
type ActivePayment = {
  id: number; order_id: string; amount: number; pay_amount: number;
  pay_currency: string; network: string; address: string; status: string;
  track_id: string; qr_code?: string; expired_at: number; created_at: string;
};

// ── SVG icon primitives ─────────────────────────────────────────────────────

function IconCopy({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}

function IconCheck({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function IconX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function IconClock({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function IconRefresh({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  );
}

function IconChevron({ size = 16, up }: { size?: number; up?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: up ? "rotate(180deg)" : undefined }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

function IconWallet({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
    </svg>
  );
}

function IconHistory({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="12 8 12 12 14 14"/>
      <path d="M3.05 11a9 9 0 1 1 .5 4m-.5-4V7l3 3-3 3"/>
    </svg>
  );
}

function IconQR({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
      <path d="M14 14h3v3m0 3h3m-3 0v-3m3 0h-3"/>
    </svg>
  );
}

// ── Small utility components ─────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).catch(() => {});
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded-md hover:bg-muted/70 transition-colors text-muted-foreground hover:text-foreground shrink-0"
    >
      {done ? <IconCheck size={13} /> : <IconCopy size={13} />}
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    pending:    { label: "Pending",    cls: "bg-white/5 text-white/40 ring-1 ring-white/10" },
    confirming: { label: "Confirming", cls: "bg-white/5 text-white/40 ring-1 ring-white/10" },
    paid:       { label: "Paid",       cls: "bg-white/5 text-white/60 ring-1 ring-white/15" },
    expired:    { label: "Expired",    cls: "bg-white/5 text-white/30 ring-1 ring-white/10" },
    failed:     { label: "Failed",     cls: "bg-white/5 text-white/30 ring-1 ring-white/10" },
  };
  const { label, cls } = cfg[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", cls)}>{label}</span>
  );
}

function Countdown({ expiredAt }: { expiredAt: number }) {
  const [secs, setSecs] = useState(() => Math.max(0, expiredAt - Math.floor(Date.now() / 1000)));
  useEffect(() => {
    if (secs <= 0) return;
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return (
    <span className={cn("font-mono font-semibold tabular-nums text-xs", secs === 0 ? "text-destructive" : "")}>
      {secs === 0 ? "Expired" : `${m}:${String(s).padStart(2, "0")}`}
    </span>
  );
}

function Divider() {
  return <div className="h-px bg-border mx-4" />;
}

// ── Main page ────────────────────────────────────────────────────────────────

export function DonatePage() {
  const { headers } = useApiAuth();
  const h = headers as Record<string, string>;
  const hRef = useRef(h);
  useEffect(() => { hRef.current = h; });

  const [amount, setAmount]           = useState("10");
  const [payCurrency, setPayCurrency] = useState("USDT");
  const [network, setNetwork]         = useState("TRC20");
  const [coins, setCoins]             = useState<Coin[]>([]);
  const [loadingCoins, setLoadingCoins]       = useState(true);
  const [history, setHistory]                 = useState<Donation[]>([]);
  const [loadingHistory, setLoadingHistory]   = useState(true);
  const [staticAddrs, setStaticAddrs]         = useState<StaticAddr[]>([]);
  const [showStatic, setShowStatic]           = useState(false);
  const [staticNetwork, setStaticNetwork]     = useState("TRC20");
  const [genStatic, setGenStatic]             = useState(false);
  const [creating, setCreating]               = useState(false);
  const [starsCreating, setStarsCreating]     = useState(false);
  const [payment, setPayment]                 = useState<PaymentData | null>(null);
  const [checking, setChecking]               = useState(false);
  const [activePayments, setActivePayments]   = useState<ActivePayment[]>([]);
  const [expandedActive, setExpandedActive]   = useState<number | null>(null);
  const [checkingActive, setCheckingActive]   = useState<string | null>(null);
  const [premiumActive, setPremiumActive]     = useState(false);
  const [premiumExpires, setPremiumExpires]   = useState<string | null>(null);
  const [buyingPremium, setBuyingPremium]     = useState(false);
  const [groups, setGroups]                   = useState<{ chat_id: string; title: string; chat_type: string; member_count: number }[]>([]);
  const [groupAction, setGroupAction]         = useState<string | null>(null);
  const [confirmBanChat, setConfirmBanChat]   = useState<string | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCoins = useCallback(() => {
    fetch(`${API_BASE}/donations/currencies`)
      .then(r => r.json())
      .then((d: any) => {
        const list: Coin[] = Array.isArray(d.coins) ? d.coins : [];
        if (list.length) {
          setCoins(list);
          setPayCurrency(list[0].symbol);
          setNetwork(list[0].networks[0] ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCoins(false));
  }, []);

  const loadHistory = useCallback(() => {
    fetch(`${API_BASE}/donations/history`, { headers: hRef.current })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setHistory(d))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, []);

  const loadActivePayments = useCallback(() => {
    fetch(`${API_BASE}/donations/active`, { headers: hRef.current })
      .then(r => r.json())
      .then((d: any) => {
        if (d.ok && Array.isArray(d.payments)) setActivePayments(d.payments);
      })
      .catch(() => {});
  }, []);

  const checkActivePayment = async (trackId: string) => {
    setCheckingActive(trackId);
    const tid = toast.loading("Checking payment...");
    try {
      const res = await fetch(`${API_BASE}/donations/status/${trackId}`, { headers: h });
      const data = await res.json();
      if (data.status === "paid") {
        toast.success("Payment confirmed!", { id: tid });
        loadActivePayments(); loadHistory();
      } else if (data.status === "expired") {
        toast.info("Invoice expired.", { id: tid });
        loadActivePayments(); loadHistory();
      } else if (data.status === "confirming") {
        toast.info("Confirming on-chain...", { id: tid });
      } else {
        toast.info(`Status: ${data.status}`, { id: tid });
      }
    } catch {
      toast.error("Could not check status.", { id: tid });
    } finally {
      setCheckingActive(null);
    }
  };

  const loadStatic = useCallback(() => {
    fetch(`${API_BASE}/donations/static-addresses`, { headers: hRef.current })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setStaticAddrs(d);
          if (d.length > 0) setShowStatic(true);
        }
      })
      .catch(() => {});
  }, []);

  const loadPremium = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/premium/status`, { headers: hRef.current });
      const data = await res.json();
      setPremiumActive(!!data.active);
      setPremiumExpires(data.subscription?.expires_at ?? null);
    } catch { /* ignore */ }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/premium/groups`, { headers: hRef.current });
      const data = await res.json();
      if (data.ok) setGroups(data.chats ?? []);
    } catch { /* ignore */ }
  }, []);

  const handleTagAll = async (chatId: string) => {
    setGroupAction(`tag-${chatId}`);
    try {
      const res = await fetch(`${API_BASE}/premium/tag-all`, {
        method: "POST", headers: { ...hRef.current, "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId }),
      });
      const data = await res.json();
      if (data.ok) toast.success(`Tagged — ${data.chunks_sent} message(s) sent`);
      else toast.error(data.error ?? "Failed");
    } catch { toast.error("Network error"); }
    finally { setGroupAction(null); }
  };

  const handleBanAll = async (chatId: string) => {
    if (confirmBanChat !== chatId) { setConfirmBanChat(chatId); toast("Tap again to confirm — bans everyone."); return; }
    setConfirmBanChat(null);
    setGroupAction(`ban-${chatId}`);
    try {
      const res = await fetch(`${API_BASE}/premium/ban-all`, {
        method: "POST", headers: { ...hRef.current, "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId }),
      });
      const data = await res.json();
      if (data.ok) { toast.success(`Banned ${data.banned} / ${data.total}`); loadGroups(); }
      else toast.error(data.error ?? "Failed");
    } catch { toast.error("Network error"); }
    finally { setGroupAction(null); }
  };

  const handleBuyPremium = async () => {
    setBuyingPremium(true);
    try {
      const res = await fetch(`${API_BASE}/premium/create`, {
        method: "POST", headers: { ...hRef.current, "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok || data.error) { toast.error(data.error ?? "Failed"); return; }
      const twa = (window as any).Telegram?.WebApp;
      if (twa?.openInvoice) {
        twa.openInvoice(data.invoice_link, (status: string) => {
          if (status === "paid") { toast.success("Premium activated!"); loadPremium(); loadGroups(); }
          else if (status === "cancelled") toast.info("Payment cancelled");
          else if (status === "failed") toast.error("Payment failed");
        });
      } else {
        window.open(data.invoice_link, "_blank");
      }
    } catch { toast.error("Network error"); }
    finally { setBuyingPremium(false); }
  };

  useEffect(() => {
    loadCoins();
    loadHistory();
    loadActivePayments();
    loadStatic();
    loadPremium();
    loadGroups();
    ticker.current = setInterval(() => { loadHistory(); loadActivePayments(); }, 15_000);
    return () => { if (ticker.current) clearInterval(ticker.current); };
  }, []);

  const selectedCoin       = coins.find(c => c.symbol === payCurrency);
  const availableNetworks  = selectedCoin?.networks ?? [];
  const amountNum          = parseFloat(amount);
  const valid              = !isNaN(amountNum) && amountNum >= 1;

  const handleCoinSelect = (coin: Coin) => {
    setPayCurrency(coin.symbol);
    setNetwork(coin.networks[0] ?? "");
  };

  const handleCreate = async () => {
    if (!valid) return;
    setCreating(true);
    const tid = toast.loading("Creating invoice...");
    try {
      const res = await fetch(`${API_BASE}/donations/create`, {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum, pay_currency: payCurrency, network }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { toast.error(data.error ?? "Failed", { id: tid }); return; }
      toast.success("Invoice created", { id: tid });
      setPayment({
        trackId: data.trackId, address: data.address,
        payAmount: data.payAmount, payCurrency: data.payCurrency,
        network: data.network, qrCode: data.qrCode,
        expiredAt: data.expiredAt, amount: data.amount,
      });
      loadHistory();
      loadActivePayments();
    } catch {
      toast.error("Network error, try again.", { id: tid });
    } finally {
      setCreating(false);
    }
  };

  const handleCheck = async () => {
    if (!payment?.trackId) return;
    setChecking(true);
    const tid = toast.loading("Checking payment...");
    try {
      const res = await fetch(`${API_BASE}/donations/status/${payment.trackId}`, { headers: h });
      const data = await res.json();
      if (data.status === "paid") {
        toast.success("Payment confirmed. Thank you!", { id: tid });
        setPayment(null); loadHistory();
      } else if (data.status === "expired") {
        toast.info("Invoice expired. Create a new one.", { id: tid });
        setPayment(null); loadHistory();
      } else if (data.status === "confirming") {
        toast.info("Detected on-chain. Waiting for confirmation.", { id: tid });
      } else {
        toast.info(`Not paid yet (${data.status}).`, { id: tid });
      }
      loadHistory();
    } catch {
      toast.error("Could not check status.", { id: tid });
    } finally {
      setChecking(false);
    }
  };

  const handleStarsDonate = async () => {
    if (!valid) return;
    setStarsCreating(true);
    const tid = toast.loading("Creating Stars invoice...");
    try {
      const res = await fetch(`${API_BASE}/donations/stars/create`, {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { toast.error(data.error ?? "Failed", { id: tid }); return; }
      toast.dismiss(tid);

      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openInvoice) {
        tg.openInvoice(data.invoiceLink, (status: string) => {
          if (status === "paid") {
            toast.success(`Thank you! ${data.stars} Stars donated.`);
            loadHistory();
          } else if (status === "cancelled") {
            toast.info("Payment cancelled.");
          } else if (status === "failed") {
            toast.error("Payment failed. Try again.");
          }
        });
      } else {
        window.open(data.invoiceLink, "_blank");
        toast.success("Invoice opened — complete payment in Telegram.", { id: tid });
      }
    } catch {
      toast.error("Network error. Try again.", { id: tid });
    } finally {
      setStarsCreating(false);
    }
  };

  const handleGenStatic = async () => {
    if (!staticNetwork) return;
    setGenStatic(true);
    const tid = toast.loading(`Generating ${staticNetwork} address...`);
    try {
      const res = await fetch(`${API_BASE}/donations/static-address`, {
        method: "POST",
        headers: { ...hRef.current, "Content-Type": "application/json" },
        body: JSON.stringify({ network: staticNetwork }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Address ready", { id: tid });
        setShowStatic(true);
        loadStatic();
      } else {
        toast.error(data.error ?? "Failed", { id: tid });
      }
    } catch {
      toast.error("Network error", { id: tid });
    } finally {
      setGenStatic(false);
    }
  };

  const handleRevoke = async (address: string) => {
    const tid = toast.loading("Revoking...");
    try {
      const res = await fetch(`${API_BASE}/donations/static-address`, {
        method: "DELETE",
        headers: { ...hRef.current, "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (data.ok) { toast.success("Address revoked", { id: tid }); loadStatic(); }
      else toast.error(data.error ?? "Failed", { id: tid });
    } catch {
      toast.error("Network error", { id: tid });
    }
  };

  return (
    <Layout title="Donate">
      <div className="h-full overflow-y-auto">
        <div className="max-w-md mx-auto">

          {/* ── Premium card ── */}
          <section className="px-4 pt-4 pb-2">
            <div className={cn(
              "rounded-2xl border p-4 space-y-3",
              premiumActive
                ? "border-white/20 bg-white/5"
                : "border-border bg-muted/20",
            )}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-base">⭐</span>
                    <p className="text-sm font-bold">
                      {premiumActive ? "Premium Active" : "Get Premium"}
                    </p>
                    {premiumActive && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/60 ring-1 ring-white/15">
                        Active
                      </span>
                    )}
                  </div>
                  {premiumActive && premiumExpires ? (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Expires {formatDateIST(premiumExpires)}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Tag All · Ban All · Silent Ban · 30 days · 250 &#11088;
                    </p>
                  )}
                </div>
                {!premiumActive && (
                  <button
                    onClick={handleBuyPremium}
                    disabled={buyingPremium}
                    className="shrink-0 h-8 px-3 rounded-xl bg-white/15 border border-white/20 text-white text-xs font-bold hover:bg-white/25 disabled:opacity-50 transition-colors"
                  >
                    {buyingPremium ? "..." : "$5 / mo"}
                  </button>
                )}
              </div>
              {groups.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium text-muted-foreground">Groups & Channels</p>
                    {!premiumActive && (
                      <span className="text-[10px] text-white/40 font-medium">Requires Premium</span>
                    )}
                  </div>
                  {groups.map(g => (
                    <div key={g.chat_id} className="rounded-xl border border-border bg-background/60 px-3 py-2 space-y-1.5">
                      <div>
                        <p className="text-xs font-semibold truncate">{g.title || `Chat ${g.chat_id}`}</p>
                        <p className="text-[10px] text-muted-foreground">{g.member_count} tracked · {g.chat_type}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => premiumActive ? handleTagAll(g.chat_id) : handleBuyPremium()}
                          disabled={!!groupAction}
                          className="flex-1 h-7 text-[11px] font-medium rounded-lg border border-border hover:bg-muted/60 disabled:opacity-40 transition-colors"
                        >
                          {groupAction === `tag-${g.chat_id}` ? "..." : premiumActive ? "Tag All" : "⭐ Tag All"}
                        </button>
                        <button
                          onClick={() => premiumActive ? handleBanAll(g.chat_id) : handleBuyPremium()}
                          disabled={!!groupAction}
                          className={cn(
                            "flex-1 h-7 text-[11px] font-medium rounded-lg border transition-colors",
                            confirmBanChat === g.chat_id && premiumActive
                              ? "border-destructive bg-destructive/10 text-destructive"
                              : "border-border hover:bg-muted/60 disabled:opacity-40",
                          )}
                        >
                          {groupAction === `ban-${g.chat_id}` ? "..." : confirmBanChat === g.chat_id && premiumActive ? "Confirm" : premiumActive ? "Ban All" : "⭐ Ban All"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {groups.length === 0 && (
                <p className="text-[11px] text-muted-foreground leading-relaxed pt-1 border-t border-border/40">
                  Add the bot as admin to any group or channel — Tag All and Ban All controls will appear here.
                </p>
              )}
            </div>
          </section>

          {/* ── Active Payments ── */}
          {activePayments.length > 0 && (
            <>
              <Divider />
              <section className="px-4 py-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                  <p className="text-sm font-semibold">Active Payments</p>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20">
                    {activePayments.length}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  These payment addresses are waiting for your crypto transfer. Send the exact amount before the timer expires.
                </p>
                <div className="space-y-2">
                  {activePayments.map(ap => {
                    const isExpanded = expandedActive === ap.id;
                    return (
                      <div key={ap.id} className="border border-border rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedActive(isExpanded ? null : ap.id)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm tabular-nums">
                                {ap.pay_amount} {ap.pay_currency}
                              </span>
                              <span className="text-[10px] px-1.5 py-px rounded-full border border-border text-muted-foreground">
                                {ap.network}
                              </span>
                              <StatusPill status={ap.status} />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              ${ap.amount.toFixed(2)} USD · Expires in <Countdown expiredAt={ap.expired_at} />
                            </p>
                          </div>
                          <span className="text-muted-foreground shrink-0">
                            <IconChevron size={14} up={isExpanded} />
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                            <div className="flex gap-3 items-start">
                              {ap.qr_code && (
                                <img
                                  src={ap.qr_code}
                                  alt="Payment QR"
                                  className="h-[80px] w-[80px] rounded-xl border border-border bg-white shrink-0"
                                />
                              )}
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Send exactly</p>
                                <p className="text-xl font-bold tabular-nums">
                                  {ap.pay_amount}
                                  <span className="text-sm font-semibold text-muted-foreground ml-1">{ap.pay_currency}</span>
                                </p>
                                <p className="text-[10px] text-muted-foreground">≈ ${ap.amount.toFixed(2)} USD</p>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Wallet address</p>
                              <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2.5 border border-border">
                                <p className="font-mono text-[11px] flex-1 break-all leading-relaxed">{ap.address}</p>
                                <CopyBtn text={ap.address} />
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => checkActivePayment(ap.track_id)}
                                disabled={checkingActive === ap.track_id}
                                className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
                              >
                                {checkingActive === ap.track_id
                                  ? <IconRefresh size={12} className="animate-spin" />
                                  : <IconCheck size={12} />}
                                I've Paid
                              </button>
                              <button
                                onClick={() => {
                                  setPayment({
                                    trackId: ap.track_id, address: ap.address,
                                    payAmount: ap.pay_amount, payCurrency: ap.pay_currency,
                                    network: ap.network, qrCode: ap.qr_code,
                                    expiredAt: ap.expired_at, amount: ap.amount,
                                  });
                                  setExpandedActive(null);
                                }}
                                className="h-9 px-3 rounded-xl border border-border text-xs font-medium text-muted-foreground flex items-center gap-1.5 hover:bg-muted/40 transition-colors"
                              >
                                <IconQR size={11} />
                                Full View
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          <Divider />

          {/* ── Amount ── */}
          <section className="px-4 pt-5 pb-4">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Amount (USD)</p>
            <div className="flex items-center border border-border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/60 transition-all bg-background">
              <span className="pl-4 pr-2 text-lg text-muted-foreground font-medium select-none">$</span>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="flex-1 py-3 pr-4 text-2xl font-bold bg-transparent outline-none tabular-nums"
                placeholder="10"
                min="1"
              />
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2.5">
              {PRESET_AMOUNTS.map(v => (
                <button
                  key={v}
                  onClick={() => setAmount(String(v))}
                  className={cn(
                    "py-1.5 rounded-lg text-xs font-semibold border transition-all",
                    amount === String(v)
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border bg-transparent text-foreground hover:bg-muted"
                  )}
                >
                  ${v}
                </button>
              ))}
            </div>
          </section>

          <Divider />

          {/* ── Currency & Network ── */}
          <section className="px-4 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Pay with</p>
              {payCurrency && (
                <span className="text-[11px] font-semibold text-primary">{payCurrency}</span>
              )}
            </div>

            {loadingCoins ? (
              <div className="flex gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-8 w-14 rounded-lg bg-muted animate-pulse shrink-0" />
                ))}
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                {coins.map(c => (
                  <button
                    key={c.symbol}
                    onClick={() => handleCoinSelect(c)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold border shrink-0 transition-all",
                      payCurrency === c.symbol
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border text-foreground hover:bg-muted"
                    )}
                  >
                    {c.symbol}
                  </button>
                ))}
              </div>
            )}

            {availableNetworks.length > 1 && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground">Network</p>
                <div className="flex gap-1.5 flex-wrap">
                  {availableNetworks.map(n => (
                    <button
                      key={n}
                      onClick={() => setNetwork(n)}
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-all",
                        network === n
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <Divider />

          {/* ── Pay button ── */}
          <section className="px-4 pb-3 pt-4 space-y-2.5">
            <button
              onClick={handleCreate}
              disabled={creating || !valid}
              className={cn(
                "w-full h-12 rounded-xl text-sm font-semibold transition-all border-2",
                valid && !creating
                  ? "bg-primary text-primary-foreground border-primary hover:opacity-90 active:scale-[0.985]"
                  : "bg-muted text-muted-foreground border-muted cursor-not-allowed opacity-60"
              )}
            >
              {creating ? (
                <span className="flex items-center justify-center gap-2">
                  <IconRefresh size={13} className="animate-spin" />
                  Creating invoice...
                </span>
              ) : `Donate $${valid ? amountNum.toFixed(2) : "0.00"} in ${payCurrency}`}
            </button>

            {/* ── Telegram Stars alternative ── */}
            <div className="flex items-center gap-2 py-0.5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] text-muted-foreground px-1">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <button
              onClick={handleStarsDonate}
              disabled={starsCreating || !valid}
              className={cn(
                "w-full h-11 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 border-2",
                valid && !starsCreating
                  ? "bg-transparent text-white/60 border-white/20 hover:bg-white/10 active:scale-[0.985]"
                  : "bg-muted text-muted-foreground border-muted cursor-not-allowed opacity-60"
              )}
            >
              {starsCreating ? (
                <>
                  <IconRefresh size={13} className="animate-spin" />
                  Creating Stars invoice...
                </>
              ) : (
                <>
                  <span className="text-base leading-none">⭐</span>
                  {valid
                    ? `Donate ${Math.round(amountNum * 50).toLocaleString()} Stars`
                    : "Donate with Stars"}
                </>
              )}
            </button>
            <p className="text-center text-[10px] text-muted-foreground">
              50 Stars ≈ $1.00 · paid instantly from your Telegram balance
            </p>
          </section>

          {/* ── Payment receipt ── */}
          {payment && (
            <>
              <Divider />
              <section className="px-4 py-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold">Send payment</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <IconClock size={11} />
                      Expires in&nbsp;<Countdown expiredAt={payment.expiredAt} />
                    </p>
                  </div>
                  <button
                    onClick={() => setPayment(null)}
                    className="p-1.5 -mr-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                  >
                    <IconX size={14} />
                  </button>
                </div>

                <div className="flex gap-4 items-start">
                  {payment.qrCode && (
                    <img
                      src={payment.qrCode}
                      alt="Payment QR code"
                      className="h-[92px] w-[92px] rounded-xl border border-border bg-white shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Send exactly</p>
                    <p className="text-[26px] leading-none font-bold tabular-nums">
                      {payment.payAmount}
                      <span className="text-base font-semibold text-muted-foreground ml-1.5">{payment.payCurrency}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">≈ ${payment.amount.toFixed(2)} USD</p>
                    <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground mt-1">
                      {payment.network}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Wallet address</p>
                  <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2.5 border border-border">
                    <p className="font-mono text-[11px] flex-1 break-all leading-relaxed">{payment.address}</p>
                    <CopyBtn text={payment.address} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCheck}
                    disabled={checking}
                    className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {checking
                      ? <IconRefresh size={13} className="animate-spin" />
                      : <IconCheck size={13} />}
                    I've Paid
                  </button>
                  <button
                    onClick={handleCheck}
                    disabled={checking}
                    title="Refresh status"
                    className="h-10 w-10 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                  >
                    <IconRefresh size={13} className={checking ? "animate-spin" : undefined} />
                  </button>
                </div>

                <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed">
                  Send the exact amount above to this address. Do not send from an exchange.
                </p>
              </section>
            </>
          )}

          <Divider />

          {/* ── Static addresses ── */}
          <section>
            <button
              onClick={() => setShowStatic(v => !v)}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/30 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground shrink-0">
                  <IconWallet size={15} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Static Addresses</p>
                  <p className="text-xs text-muted-foreground">Permanent deposit, any amount</p>
                </div>
              </div>
              <span className="text-muted-foreground">
                <IconChevron size={16} up={showStatic} />
              </span>
            </button>

            {showStatic && (
              <div className="px-4 pb-4 space-y-4">
                <div className="h-px bg-border" />

                {staticAddrs.map(a => (
                  <div key={a.id} className="border border-border rounded-xl p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                        {a.network}
                      </span>
                      <button
                        onClick={() => handleRevoke(a.address)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <IconX size={13} />
                      </button>
                    </div>
                    <div className="flex gap-3 items-start">
                      {a.qr_code && (
                        <img
                          src={a.qr_code}
                          alt="Static address QR"
                          className="h-[60px] w-[60px] rounded-lg border border-border bg-white shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1">
                          <p className="font-mono text-[11px] text-muted-foreground break-all flex-1 leading-relaxed">{a.address}</p>
                          <CopyBtn text={a.address} />
                        </div>
                        {a.memo && (
                          <div className="flex items-center gap-1">
                            <p className="text-[10px] text-muted-foreground">
                              Memo: <span className="font-mono">{a.memo}</span>
                            </p>
                            <CopyBtn text={a.memo} />
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground/50">
                          {formatDateIST(a.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground font-medium">Generate new address</p>
                  <div className="grid grid-cols-4 gap-2">
                    {STATIC_NETWORKS.map(n => {
                      const active = staticAddrs.some(a => a.network === n.id);
                      const selected = staticNetwork === n.id;
                      return (
                        <button
                          key={n.id}
                          onClick={() => setStaticNetwork(n.id)}
                          className={cn(
                            "flex flex-col items-center py-2.5 px-1 rounded-xl border transition-all",
                            selected
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border hover:bg-muted/40 text-foreground"
                          )}
                        >
                          <span className="text-xs font-bold">{n.label}</span>
                          <span className="text-[9px] text-muted-foreground leading-tight mt-0.5">{n.sub}</span>
                          {active && (
                            <span className="mt-1 text-white/60">
                              <IconCheck size={10} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={handleGenStatic}
                    disabled={genStatic || !staticNetwork}
                    className="w-full h-9 rounded-xl border border-dashed border-border text-xs font-medium text-muted-foreground flex items-center justify-center gap-2 hover:bg-muted/30 hover:text-foreground disabled:opacity-40 transition-all"
                  >
                    {genStatic
                      ? <><IconRefresh size={13} className="animate-spin" />Generating...</>
                      : <><IconQR size={13} />Generate {staticNetwork} Address</>}
                  </button>
                </div>
              </div>
            )}
          </section>

          <Divider />

          {/* ── History ── */}
          <section className="px-4 py-4 pb-10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-foreground">
                <IconHistory size={15} />
                <span className="text-sm font-semibold">History</span>
              </div>
              <button
                onClick={loadHistory}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <IconRefresh size={13} />
              </button>
            </div>

            {loadingHistory ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-[62px] rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : !history.length ? (
              <p className="text-center text-sm text-muted-foreground py-8">No donations yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map(d => (
                  <HistoryRow
                    key={d.id}
                    donation={d}
                    headers={h}
                    onReopen={() => {
                      if (d.track_id && d.address && d.pay_amount && d.pay_currency && d.network && d.expired_at) {
                        setPayment({
                          trackId: d.track_id, address: d.address,
                          payAmount: d.pay_amount, payCurrency: d.pay_currency,
                          network: d.network, qrCode: d.qr_code,
                          expiredAt: d.expired_at, amount: d.amount,
                        });
                      }
                    }}
                    onRefresh={loadHistory}
                  />
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </Layout>
  );
}

// ── History row ──────────────────────────────────────────────────────────────

function HistoryRow({
  donation: d, headers, onReopen, onRefresh,
}: {
  donation: Donation;
  headers: Record<string, string>;
  onReopen: () => void;
  onRefresh: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const canReopen = d.status === "pending" && !!d.address && !!d.expired_at && d.expired_at > Date.now() / 1000;

  const check = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!d.track_id) return;
    setChecking(true);
    const tid = toast.loading("Checking...");
    try {
      const res = await fetch(`${API_BASE}/donations/status/${d.track_id}`, { headers });
      const data = await res.json();
      const labels: Record<string, string> = {
        paid: "Payment confirmed!", expired: "Invoice expired.", confirming: "Confirming on-chain.",
      };
      toast[data.status === "paid" ? "success" : "info"](labels[data.status] ?? `Status: ${data.status}`, { id: tid });
      onRefresh();
    } catch {
      toast.error("Could not check status.", { id: tid });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-xl border border-border",
        canReopen && "cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors"
      )}
      onClick={canReopen ? onReopen : undefined}
    >
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm tabular-nums">
            {d.pay_amount ? `${d.pay_amount} ${d.pay_currency}` : `$${d.amount.toFixed(2)}`}
          </span>
          {d.network && (
            <span className="text-[10px] px-1.5 py-px rounded-full border border-border text-muted-foreground">
              {d.network}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          ${d.amount.toFixed(2)} USD · {relativeTime(d.created_at)}
        </p>
        {d.status === "pending" && d.expired_at && (
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground/70 mt-0.5">
            <IconClock size={10} />
            Expires <Countdown expiredAt={d.expired_at} />
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <StatusPill status={d.status} />
        {d.status === "pending" && d.track_id && (
          <button
            onClick={check}
            disabled={checking}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-50 transition-colors"
          >
            <IconRefresh size={12} className={checking ? "animate-spin" : undefined} />
          </button>
        )}
      </div>
    </div>
  );
}
