import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Coins, History, Copy, Check, X, Wallet,
  ChevronDown, ChevronUp, RefreshCw, Clock, QrCode,
  ArrowUpRight, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/miniapp", "") + "/api";

const PRESET_AMOUNTS = [5, 10, 25, 50];

const STATIC_NETWORKS = [
  { id: "TRC20",   label: "TRC20",  sub: "USDT · TRX" },
  { id: "BEP20",   label: "BEP20",  sub: "USDT · BNB" },
  { id: "ERC20",   label: "ERC20",  sub: "USDT · ETH" },
  { id: "BTC",     label: "BTC",    sub: "Bitcoin" },
  { id: "LTC",     label: "LTC",    sub: "Litecoin" },
  { id: "TON",     label: "TON",    sub: "TON · DOGS" },
  { id: "SOL",     label: "SOL",    sub: "Solana" },
  { id: "DOGE",    label: "DOGE",   sub: "Dogecoin" },
];

type Coin = { symbol: string; networks: string[] };
type StaticAddr = {
  id: number; address: string; network: string; track_id?: string;
  qr_code?: string; memo?: string; created_at: string;
};
type Donation = {
  id: number; amount: number; currency: string;
  pay_amount?: number; pay_currency?: string; network?: string;
  address?: string; qr_code?: string; expired_at?: number;
  status: string; track_id?: string; created_at: string;
};

function CopyBtn({ text, size = "sm" }: { text: string; size?: "sm" | "xs" }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className={size === "xs" ? "h-6 w-6" : "h-7 w-7"}
      onClick={e => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied
        ? <Check className={cn("text-emerald-500", size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5")} />
        : <Copy className={cn("text-muted-foreground", size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5")} />}
    </Button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending:    { label: "Pending",    className: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" },
    confirming: { label: "Confirming", className: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
    paid:       { label: "Paid",       className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
    expired:    { label: "Expired",    className: "bg-muted text-muted-foreground border-border" },
    failed:     { label: "Failed",     className: "bg-red-500/15 text-red-500 border-red-500/30" },
  };
  const s = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={cn("text-[10px] font-semibold", s.className)}>{s.label}</Badge>;
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
  const expired = secs === 0;
  return (
    <span className={cn("font-mono text-sm font-semibold tabular-nums", expired ? "text-destructive" : "text-foreground")}>
      {expired ? "Expired" : `${m}:${String(s).padStart(2, "0")}`}
    </span>
  );
}

export function DonatePage() {
  const { headers } = useApiAuth();
  const h = headers as Record<string, string>;

  const [amount, setAmount] = useState("10");
  const [payCurrency, setPayCurrency] = useState("USDT");
  const [network, setNetwork] = useState("TRC20");
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loadingCoins, setLoadingCoins] = useState(true);

  const [history, setHistory] = useState<Donation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [staticAddrs, setStaticAddrs] = useState<StaticAddr[]>([]);
  const [showStatic, setShowStatic] = useState(false);
  const [staticNetwork, setStaticNetwork] = useState("TRC20");
  const [genStatic, setGenStatic] = useState(false);

  const [creating, setCreating] = useState(false);
  const [paymentData, setPaymentData] = useState<{
    trackId: string; address: string; payAmount: number; payCurrency: string;
    network: string; qrCode?: string; expiredAt: number; amount: number;
  } | null>(null);
  const [checking, setChecking] = useState(false);

  const historyTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCoins = () => {
    fetch(`${API_BASE}/donations/currencies`)
      .then(r => r.json())
      .then((d: any) => {
        const list: Coin[] = Array.isArray(d.coins) ? d.coins : [];
        if (list.length) {
          setCoins(list);
          const first = list[0];
          setPayCurrency(first.symbol);
          setNetwork(first.networks[0] ?? "");
        } else {
          setCoins([
            { symbol: "USDT", networks: ["TRC20", "BEP20", "ERC20", "TON"] },
            { symbol: "BTC",  networks: ["BTC"] },
            { symbol: "ETH",  networks: ["ERC20"] },
            { symbol: "LTC",  networks: ["LTC"] },
          ]);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCoins(false));
  };

  const loadHistory = () => {
    fetch(`${API_BASE}/donations/history`, { headers: h })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setHistory(d))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  };

  const loadStaticAddrs = () => {
    fetch(`${API_BASE}/donations/static-addresses`, { headers: h })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setStaticAddrs(d))
      .catch(() => {});
  };

  useEffect(() => {
    loadCoins();
    loadHistory();
    loadStaticAddrs();
    historyTimer.current = setInterval(loadHistory, 15000);
    return () => { if (historyTimer.current) clearInterval(historyTimer.current); };
  }, []);

  const selectedCoin = coins.find(c => c.symbol === payCurrency);
  const availableNetworks = selectedCoin?.networks ?? [];
  const amountNum = parseFloat(amount);
  const amountValid = !isNaN(amountNum) && amountNum > 0;

  const handleCoinSelect = (coin: Coin) => {
    setPayCurrency(coin.symbol);
    setNetwork(coin.networks[0] ?? "");
  };

  const handleCreate = async () => {
    if (!amountValid) return;
    setCreating(true);
    const toastId = toast.loading("Creating invoice…");
    try {
      const res = await fetch(`${API_BASE}/donations/create`, {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum, pay_currency: payCurrency, network }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error ?? `Error (${res.status})`, { id: toastId }); return;
      }
      toast.success("Invoice created!", { id: toastId });
      setPaymentData({
        trackId:    data.trackId,
        address:    data.address,
        payAmount:  data.payAmount,
        payCurrency: data.payCurrency,
        network:    data.network,
        qrCode:     data.qrCode,
        expiredAt:  data.expiredAt,
        amount:     data.amount,
      });
      loadHistory();
    } catch {
      toast.error("Network error — please try again.", { id: toastId });
    } finally {
      setCreating(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!paymentData?.trackId) return;
    setChecking(true);
    const toastId = toast.loading("Checking payment status…");
    try {
      const res = await fetch(`${API_BASE}/donations/status/${paymentData.trackId}`, { headers: h });
      const data = await res.json();
      if (data.status === "paid") {
        toast.success("Payment confirmed! Thank you! 🎉", { id: toastId });
        setPaymentData(null);
        loadHistory();
      } else if (data.status === "expired") {
        toast.info("Invoice expired — please create a new one.", { id: toastId });
        setPaymentData(null);
        loadHistory();
      } else if (data.status === "confirming") {
        toast.info("Payment detected — waiting for confirmation…", { id: toastId });
      } else {
        toast.info(`Status: ${data.status} — not yet paid.`, { id: toastId });
      }
      loadHistory();
    } catch {
      toast.error("Could not check status.", { id: toastId });
    } finally {
      setChecking(false);
    }
  };

  const handleGenerateStatic = async () => {
    if (!staticNetwork) return;
    setGenStatic(true);
    const toastId = toast.loading(`Generating ${staticNetwork} address…`);
    try {
      const res = await fetch(`${API_BASE}/donations/static-address`, {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ network: staticNetwork }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`${staticNetwork} address ready!`, { id: toastId });
        loadStaticAddrs();
      } else {
        toast.error(data.error ?? "Failed to generate address", { id: toastId });
      }
    } catch {
      toast.error("Network error", { id: toastId });
    } finally {
      setGenStatic(false);
    }
  };

  const handleRevokeStatic = async (address: string) => {
    const toastId = toast.loading("Revoking address…");
    try {
      const res = await fetch(`${API_BASE}/donations/static-address`, {
        method: "DELETE",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Address revoked", { id: toastId });
        loadStaticAddrs();
      } else {
        toast.error(data.error ?? "Failed to revoke", { id: toastId });
      }
    } catch {
      toast.error("Network error", { id: toastId });
    }
  };

  return (
    <Layout title="Donate">
      <div className="h-full overflow-y-auto pb-24">

        {/* ── Invoice Form ── */}
        <div className="p-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
                  <Coins className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">Make a Donation</CardTitle>
                  <CardDescription className="text-xs">
                    Powered by OxaPay · Address shown inline
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">

              {/* Amount */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Amount (USD)</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                  <Input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="pl-7 text-lg font-semibold"
                    placeholder="10.00"
                    min="1"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_AMOUNTS.map(v => (
                    <Button
                      key={v}
                      variant={amount === String(v) ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs font-medium"
                      onClick={() => setAmount(String(v))}
                    >
                      ${v}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Currency */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Pay with</p>
                  {payCurrency && <Badge variant="secondary" className="text-xs">{payCurrency}</Badge>}
                </div>
                {loadingCoins ? (
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto">
                    {coins.slice(0, 16).map(c => (
                      <Button
                        key={c.symbol}
                        variant={payCurrency === c.symbol ? "default" : "outline"}
                        size="sm"
                        className="h-9 text-xs font-semibold"
                        onClick={() => handleCoinSelect(c)}
                      >
                        {c.symbol}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Network */}
              {availableNetworks.length > 1 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Network</p>
                  <div className="flex gap-2 flex-wrap">
                    {availableNetworks.map(n => (
                      <Button
                        key={n}
                        variant={network === n ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs rounded-full px-3"
                        onClick={() => setNetwork(n)}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleCreate}
                disabled={creating || !amountValid}
                className="w-full h-11"
                size="lg"
              >
                {creating
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating invoice…</>
                  : `Donate $${amountValid ? amountNum.toFixed(2) : "0.00"} in ${payCurrency}`}
              </Button>
            </CardContent>
          </Card>

          {/* ── Payment Screen (inline, no redirect) ── */}
          <AnimatePresence>
            {paymentData && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm">Send Payment</CardTitle>
                        <CardDescription className="text-xs">
                          Exact amount · expires in&nbsp;
                          <Countdown expiredAt={paymentData.expiredAt} />
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => setPaymentData(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">

                    {/* QR + details side-by-side on wider screens */}
                    <div className="flex gap-4 items-start">
                      {paymentData.qrCode && (
                        <div className="shrink-0">
                          <img
                            src={paymentData.qrCode}
                            alt="QR code"
                            className="h-24 w-24 rounded-lg border border-border bg-white"
                          />
                        </div>
                      )}
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Send exactly</p>
                          <p className="text-xl font-bold tracking-tight">
                            {paymentData.payAmount} <span className="text-base font-semibold text-muted-foreground">{paymentData.payCurrency}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">≈ ${paymentData.amount.toFixed(2)} USD</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">{paymentData.network}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{paymentData.payCurrency}</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Address */}
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Payment address</p>
                      <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2">
                        <p className="font-mono text-xs flex-1 break-all text-foreground">{paymentData.address}</p>
                        <CopyBtn text={paymentData.address} />
                      </div>
                    </div>

                    <Separator />

                    <div className="flex gap-2">
                      <Button
                        className="flex-1 gap-1.5"
                        onClick={handleCheckStatus}
                        disabled={checking}
                      >
                        {checking
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Check className="h-3.5 w-3.5" />}
                        I've Paid
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={handleCheckStatus}
                        disabled={checking}
                        title="Refresh status"
                      >
                        <RefreshCw className={cn("h-3.5 w-3.5", checking && "animate-spin")} />
                      </Button>
                    </div>

                    <p className="text-[10px] text-muted-foreground/60 text-center">
                      Send exactly {paymentData.payAmount} {paymentData.payCurrency} to the address above.
                      Do not send from an exchange.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Static Addresses ── */}
          <Card>
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between px-4 py-3.5 h-auto rounded-xl"
              onClick={() => setShowStatic(v => !v)}
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-violet-500" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Static Crypto Addresses</p>
                  <p className="text-xs text-muted-foreground">
                    Permanent deposit addresses · any amount, anytime
                  </p>
                </div>
              </div>
              {showStatic ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </Button>

            <AnimatePresence>
              {showStatic && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <Separator />
                  <div className="p-4 space-y-4">

                    {/* Existing addresses */}
                    {staticAddrs.length > 0 && (
                      <div className="space-y-3">
                        {staticAddrs.map(a => (
                          <div key={a.id} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-[10px] font-semibold">{a.network}</Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleRevokeStatic(a.address)}
                              >
                                <X className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>

                            <div className="flex gap-3 items-start">
                              {a.qr_code && (
                                <img
                                  src={a.qr_code}
                                  alt="QR"
                                  className="h-16 w-16 rounded border border-border bg-white shrink-0"
                                />
                              )}
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-1">
                                  <p className="font-mono text-[11px] text-muted-foreground break-all">{a.address}</p>
                                  <CopyBtn text={a.address} size="xs" />
                                </div>
                                {a.memo && (
                                  <div className="flex items-center gap-1">
                                    <p className="text-[10px] text-muted-foreground">Memo: <span className="font-mono">{a.memo}</span></p>
                                    <CopyBtn text={a.memo} size="xs" />
                                  </div>
                                )}
                                <p className="text-[10px] text-muted-foreground/50">
                                  Added {format(new Date(a.created_at), "MMM d, yyyy")}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Generate new */}
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground">Generate new address</p>
                      <div className="grid grid-cols-4 gap-2">
                        {STATIC_NETWORKS.map(n => {
                          const hasOne = staticAddrs.some(a => a.network === n.id);
                          return (
                            <button
                              key={n.id}
                              onClick={() => setStaticNetwork(n.id)}
                              className={cn(
                                "flex flex-col items-center justify-center rounded-lg border p-2 gap-0.5 transition-colors text-center",
                                staticNetwork === n.id
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-muted/20 hover:bg-muted/40",
                              )}
                            >
                              <span className="text-xs font-bold">{n.label}</span>
                              <span className="text-[9px] text-muted-foreground leading-tight">{n.sub}</span>
                              {hasOne && <span className="text-[9px] text-emerald-500">✓ active</span>}
                            </button>
                          );
                        })}
                      </div>

                      <Button
                        variant="outline"
                        onClick={handleGenerateStatic}
                        disabled={genStatic || !staticNetwork}
                        className="w-full border-dashed gap-2 text-xs h-9"
                      >
                        {genStatic
                          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating…</>
                          : <><QrCode className="h-3.5 w-3.5" />Generate {staticNetwork} Address</>}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          {/* ── History ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Donation History</span>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadHistory}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>

            {loadingHistory ? (
              <div className="space-y-2">
                {[1,2,3].map(i => (
                  <Card key={i}><CardContent className="p-4 flex gap-4">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </CardContent></Card>
                ))}
              </div>
            ) : !history.length ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground text-sm">
                  No donations yet. Make your first contribution above.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {history.map(d => (
                  <DonationHistoryCard
                    key={d.id}
                    donation={d}
                    onReopen={() => {
                      if (d.track_id && d.address && d.pay_amount && d.pay_currency && d.network && d.expired_at) {
                        setPaymentData({
                          trackId: d.track_id,
                          address: d.address,
                          payAmount: d.pay_amount,
                          payCurrency: d.pay_currency,
                          network: d.network,
                          qrCode: d.qr_code,
                          expiredAt: d.expired_at,
                          amount: d.amount,
                        });
                      }
                    }}
                    onRefresh={loadHistory}
                    headers={h}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ── Donation history card ─────────────────────────────────────────────────────

function DonationHistoryCard({
  donation: d,
  onReopen,
  onRefresh,
  headers,
}: {
  donation: Donation;
  onReopen: () => void;
  onRefresh: () => void;
  headers: Record<string, string>;
}) {
  const [checking, setChecking] = useState(false);

  const handleCheck = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!d.track_id) return;
    setChecking(true);
    const toastId = toast.loading("Checking status…");
    try {
      const res = await fetch(`${API_BASE}/donations/status/${d.track_id}`, { headers });
      const data = await res.json();
      const msg = data.status === "paid"
        ? "Payment confirmed! 🎉"
        : data.status === "expired"
        ? "Invoice has expired"
        : `Status: ${data.status}`;
      toast[data.status === "paid" ? "success" : "info"](msg, { id: toastId });
      onRefresh();
    } catch {
      toast.error("Could not check status", { id: toastId });
    } finally {
      setChecking(false);
    }
  };

  const canReopen = d.status === "pending" && d.address && d.expired_at && d.expired_at > Date.now() / 1000;

  return (
    <Card
      className={cn(
        "transition-colors",
        canReopen && "cursor-pointer hover:bg-muted/40 active:bg-muted/60",
      )}
      onClick={canReopen ? onReopen : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">
                {d.pay_amount ? `${d.pay_amount} ${d.pay_currency}` : `$${d.amount.toFixed(2)}`}
              </span>
              {d.network && <Badge variant="outline" className="text-[10px]">{d.network}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              ${d.amount.toFixed(2)} USD ·{" "}
              {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
            </p>
            {d.address && (
              <p className="font-mono text-[10px] text-muted-foreground/60 truncate">
                {d.address}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={d.status} />
            {d.status === "pending" && d.track_id && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCheck}
                disabled={checking}
                title="Check status"
              >
                {checking
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <RefreshCw className="h-3 w-3" />}
              </Button>
            )}
            {canReopen && (
              <ArrowUpRight className="h-3 w-3 text-muted-foreground/50" />
            )}
          </div>
        </div>

        {/* Expiry for pending */}
        {d.status === "pending" && d.expired_at && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Expires in</span>
            <Countdown expiredAt={d.expired_at} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
