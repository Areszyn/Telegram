import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Coins, History, Copy, Check, X, QrCode, Wallet,
  ChevronDown, ChevronUp, RefreshCw, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/miniapp", "") + "/api";

type Coin = { symbol: string; network?: string; networks?: string[] };
type Donation = { id: number; amount: number; currency: string; status: string; track_id: string; pay_link?: string; created_at: string };
type StaticAddr = { id: number; address: string; currency: string; network: string; created_at: string };

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  paid:       { label: "Paid",       className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" },
  confirming: { label: "Confirming", className: "border-blue-500/30 bg-blue-500/10 text-blue-600" },
  expired:    { label: "Expired",    className: "border-red-500/30 bg-red-500/10 text-red-500" },
  failed:     { label: "Failed",     className: "border-red-500/30 bg-red-500/10 text-red-500" },
  pending:    { label: "Pending",    className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-600" },
};

const PRESET_AMOUNTS = [5, 10, 25, 50];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

export function DonatePage() {
  const reqOpts = useApiAuth();
  const headers = reqOpts.headers as Record<string, string>;
  const [amount, setAmount] = useState("10");
  const [currency, setCurrency] = useState("USDT");
  const [network, setNetwork] = useState("");
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loadingCoins, setLoadingCoins] = useState(true);
  const [history, setHistory] = useState<Donation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [staticAddrs, setStaticAddrs] = useState<StaticAddr[]>([]);
  const [showStatic, setShowStatic] = useState(false);
  const [payLink, setPayLink] = useState<string | null>(null);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showPayFrame, setShowPayFrame] = useState(false);
  const [genStatic, setGenStatic] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const historyTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/donations/currencies`)
      .then(r => r.json())
      .then((d: any) => {
        const list: Coin[] = Array.isArray(d.coins) ? d.coins : (Array.isArray(d) ? d : []);
        if (list.length) {
          setCoins(list);
          setCurrency(list[0].symbol);
          const nets = list[0].networks ?? (list[0].network ? [list[0].network] : []);
          setNetwork(nets[0] ?? "");
        } else {
          setCoins([{ symbol: "USDT" }, { symbol: "BTC" }, { symbol: "ETH" }, { symbol: "LTC" }]);
        }
      })
      .catch(() => setCoins([{ symbol: "USDT" }, { symbol: "BTC" }, { symbol: "ETH" }, { symbol: "LTC" }]))
      .finally(() => setLoadingCoins(false));
  }, []);

  const loadHistory = () => {
    fetch(`${API_BASE}/donations/history`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setHistory(d))
      .finally(() => setLoadingHistory(false));
  };

  const loadStaticAddrs = () => {
    fetch(`${API_BASE}/donations/static-addresses`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setStaticAddrs(d));
  };

  useEffect(() => {
    loadHistory();
    loadStaticAddrs();
    historyTimer.current = setInterval(loadHistory, 10000);
    return () => { if (historyTimer.current) clearInterval(historyTimer.current); };
  }, []);

  const selectCurrency = (coin: Coin) => {
    setCurrency(coin.symbol);
    const nets = coin.networks ?? (coin.network ? [coin.network] : []);
    setNetwork(nets[0] ?? "");
  };

  const handleDonate = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`${API_BASE}/donations/create`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num, currency }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setCreateError(data.error ?? `Server error (${res.status})`);
        return;
      }
      if (data.payLink) {
        setPayLink(data.payLink);
        setTrackId(data.trackId ?? null);
        setShowPayFrame(true);
        loadHistory();
      } else {
        setCreateError("Payment link not received from provider. Please try again.");
      }
    } catch (err: any) {
      setCreateError("Network error — please check your connection and try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateStatic = async () => {
    if (!currency || !network) return;
    setGenStatic(true);
    try {
      const res = await fetch(`${API_BASE}/donations/static-address`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ currency, network }),
      });
      const data = await res.json();
      if (data.ok) loadStaticAddrs();
    } finally {
      setGenStatic(false);
    }
  };

  const handleRevokeStatic = async (address: string) => {
    const res = await fetch(`${API_BASE}/donations/static-address`, {
      method: "DELETE",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    if (res.ok) loadStaticAddrs();
  };

  const handleVerify = async (tid: string) => {
    setVerifying(tid);
    try {
      await fetch(`${API_BASE}/donations/verify/${tid}`, { headers });
      loadHistory();
    } finally {
      setVerifying(null);
    }
  };

  const selectedCoin = coins.find(c => c.symbol === currency);
  const availableNetworks = selectedCoin?.networks ?? (selectedCoin?.network ? [selectedCoin.network] : []);

  return (
    <Layout title="Donate">
      <div className="h-full overflow-y-auto p-4 space-y-4 pb-24">

        {/* Donation Form */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Coins className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Make a Donation</CardTitle>
                <CardDescription className="text-xs">Powered by OxaPay · No redirects</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Amount */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Amount (USD)</label>
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
              <div className="flex gap-2">
                {PRESET_AMOUNTS.map(v => (
                  <Button
                    key={v}
                    variant={amount === String(v) ? "default" : "outline"}
                    size="sm"
                    className="flex-1 h-8 text-xs rounded-full"
                    onClick={() => setAmount(String(v))}
                  >
                    ${v}
                  </Button>
                ))}
              </div>
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Currency</label>
              {loadingCoins ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                  {coins.slice(0, 16).map(c => (
                    <Button
                      key={c.symbol}
                      variant={currency === c.symbol ? "default" : "outline"}
                      size="sm"
                      className="h-9 text-xs font-semibold rounded-lg"
                      onClick={() => selectCurrency(c)}
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
                <label className="text-xs font-medium text-muted-foreground">Network</label>
                <div className="flex gap-2 flex-wrap">
                  {availableNetworks.map(n => (
                    <Button
                      key={n}
                      variant={network === n ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs rounded-full"
                      onClick={() => setNetwork(n)}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {createError && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="flex items-start gap-2 p-3">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive leading-relaxed">{createError}</p>
                  <button onClick={() => setCreateError(null)} className="ml-auto shrink-0">
                    <X className="h-3.5 w-3.5 text-destructive/60" />
                  </button>
                </CardContent>
              </Card>
            )}
            <Button
              onClick={handleDonate}
              disabled={creating || parseFloat(amount) <= 0}
              className="w-full"
              size="lg"
            >
              {creating ? "Creating invoice…" : `Donate $${amount || "0"} in ${currency}`}
            </Button>
          </CardContent>
        </Card>

        {/* Static Addresses */}
        <Card>
          <button
            className="w-full flex items-center justify-between px-4 py-3.5 text-left"
            onClick={() => setShowStatic(v => !v)}
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <p className="text-sm font-semibold">Static Crypto Address</p>
                <p className="text-xs text-muted-foreground">Permanent address for {currency}</p>
              </div>
            </div>
            {showStatic ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {showStatic && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                <Separator />
                <div className="p-4 space-y-3">
                  {staticAddrs.filter(a => a.currency === currency).length > 0 ? (
                    staticAddrs.filter(a => a.currency === currency).map(a => (
                      <Card key={a.id} className="bg-muted/40">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">{a.currency}</Badge>
                              <Badge variant="secondary" className="text-[10px]">{a.network}</Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <CopyButton text={a.address} />
                              <Button variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => handleRevokeStatic(a.address)}>
                                <X className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          <p className="font-mono text-xs text-muted-foreground break-all">{a.address}</p>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      No static address for {currency} yet.
                    </p>
                  )}
                  {availableNetworks.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={handleGenerateStatic}
                      disabled={genStatic || !network}
                      className="w-full border-dashed text-xs h-9"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      {genStatic ? "Generating…" : `Generate ${currency} Address${network ? ` (${network})` : ""}`}
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* History */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Recent Donations</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadHistory}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {loadingHistory ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}><CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1.5"><Skeleton className="h-4 w-20" /><Skeleton className="h-3 w-32" /></div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </CardContent></Card>
              ))}
            </div>
          ) : !history.length ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No donations yet.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {history.map(d => {
                const status = STATUS_MAP[d.status] ?? STATUS_MAP.pending;
                return (
                  <Card key={d.id}>
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">
                          ${d.amount?.toFixed(2)}
                          <span className="text-muted-foreground font-normal ml-1 text-xs">{d.currency}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(d.created_at), "MMM d, yyyy · HH:mm")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {d.status === "pending" && d.track_id && (
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => handleVerify(d.track_id)} disabled={verifying === d.track_id}>
                            <RefreshCw className={cn("h-3.5 w-3.5", verifying === d.track_id && "animate-spin")} />
                          </Button>
                        )}
                        {d.status === "pending" && d.pay_link && (
                          <Button variant="outline" size="sm" className="h-7 text-xs"
                            onClick={() => { setPayLink(d.pay_link!); setTrackId(d.track_id); setShowPayFrame(true); }}>
                            Open
                          </Button>
                        )}
                        <Badge variant="outline" className={status.className}>{status.label}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Payment iframe */}
      <AnimatePresence>
        {showPayFrame && payLink && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
              <p className="font-semibold text-sm">Complete Payment</p>
              <Button variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => { setShowPayFrame(false); loadHistory(); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <iframe src={payLink} className="flex-1 w-full border-0 bg-white" allow="payment; clipboard-write" title="OxaPay Payment" />
            <div className="px-4 py-3 border-t border-border bg-background">
              <Button variant="outline" className="w-full"
                onClick={() => { setShowPayFrame(false); if (trackId) handleVerify(trackId); }}>
                <RefreshCw className="h-4 w-4" /> I've Paid — Check Status
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
