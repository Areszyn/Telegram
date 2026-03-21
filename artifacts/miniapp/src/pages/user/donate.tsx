import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PaymentCard, type Payment } from "@/components/payments/PaymentCard";
import { PaymentDialog } from "@/components/payments/PaymentDialog";
import { cn } from "@/lib/utils";
import {
  Coins, History, Copy, Check, X, QrCode, Wallet,
  ChevronDown, ChevronUp, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/miniapp", "") + "/api";

type Coin = { symbol: string; network?: string; networks?: string[] };
type StaticAddr = { id: number; address: string; currency: string; network: string; created_at: string };

const PRESET_AMOUNTS = [5, 10, 25, 50];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
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
  const [history, setHistory] = useState<Payment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [staticAddrs, setStaticAddrs] = useState<StaticAddr[]>([]);
  const [showStatic, setShowStatic] = useState(false);
  const [payLink, setPayLink] = useState<string | null>(null);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showPayFrame, setShowPayFrame] = useState(false);
  const [genStatic, setGenStatic] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
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
    const toastId = toast.loading("Creating invoice…");
    try {
      const res = await fetch(`${API_BASE}/donations/create`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num, currency }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error ?? `Server error (${res.status})`, { id: toastId });
        return;
      }
      if (data.payLink) {
        toast.success("Invoice created — complete payment below", { id: toastId });
        setPayLink(data.payLink);
        setTrackId(data.trackId ?? null);
        setShowPayFrame(true);
        loadHistory();
      } else {
        toast.error("Payment link not received. Please try again.", { id: toastId });
      }
    } catch {
      toast.error("Network error — check your connection and try again.", { id: toastId });
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
      if (data.ok) {
        loadStaticAddrs();
        toast.success(`${currency} address generated`);
      } else {
        toast.error(data.error ?? "Failed to generate address");
      }
    } catch {
      toast.error("Network error");
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
    if (res.ok) {
      loadStaticAddrs();
      toast.success("Address removed");
    }
  };

  const handleVerify = async (tid: string) => {
    setVerifying(tid);
    try {
      const res = await fetch(`${API_BASE}/donations/verify/${tid}`, { headers });
      const data = await res.json();
      if (data.status && data.status !== "pending") {
        toast.success(`Status updated: ${data.status}`);
      } else {
        toast.info("No update yet — payment still pending");
      }
      loadHistory();
    } catch {
      toast.error("Could not check status");
    } finally {
      setVerifying(null);
    }
  };

  const openPaymentDialog = (p: Payment) => {
    setSelectedPayment(p);
    setDialogOpen(true);
  };

  const openPayFrame = (link: string, tid: string) => {
    setPayLink(link);
    setTrackId(tid);
    setShowPayFrame(true);
  };

  const selectedCoin = coins.find(c => c.symbol === currency);
  const availableNetworks = selectedCoin?.networks ?? (selectedCoin?.network ? [selectedCoin.network] : []);
  const amountNum = parseFloat(amount);
  const amountValid = !isNaN(amountNum) && amountNum > 0;

  return (
    <Layout title="Donate">
      <div className="h-full overflow-y-auto p-4 space-y-4 pb-24">

        {/* ── Donation Form ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Coins className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Make a Donation</CardTitle>
                <CardDescription className="text-xs">Powered by OxaPay · No redirects in app</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Amount field */}
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

            {/* Currency selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Currency</p>
                {currency && <Badge variant="secondary" className="text-xs">{currency}</Badge>}
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
                      variant={currency === c.symbol ? "default" : "outline"}
                      size="sm"
                      className="h-9 text-xs font-semibold"
                      onClick={() => selectCurrency(c)}
                    >
                      {c.symbol}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Network selector */}
            {availableNetworks.length > 1 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Network</p>
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

            <Button
              onClick={handleDonate}
              disabled={creating || !amountValid}
              className="w-full"
              size="lg"
            >
              {creating
                ? <><RefreshCw className="h-4 w-4 animate-spin" /> Creating…</>
                : `Donate $${amountValid ? amountNum.toFixed(2) : "0.00"} in ${currency}`
              }
            </Button>
          </CardContent>
        </Card>

        {/* ── Static Crypto Address ── */}
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
                <p className="text-sm font-semibold">Static Crypto Address</p>
                <p className="text-xs text-muted-foreground">Permanent deposit address for {currency}</p>
              </div>
            </div>
            {showStatic
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
            }
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
                <div className="p-4 space-y-3">
                  {staticAddrs.filter(a => a.currency === currency).length > 0
                    ? staticAddrs.filter(a => a.currency === currency).map(a => (
                        <Card key={a.id} className="bg-muted/40">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-[10px]">{a.currency}</Badge>
                                <Badge variant="secondary" className="text-[10px]">{a.network}</Badge>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <CopyButton text={a.address} />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleRevokeStatic(a.address)}
                                >
                                  <X className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </div>
                            <p className="font-mono text-xs text-muted-foreground break-all">{a.address}</p>
                            <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                              Generated {format(new Date(a.created_at), "MMM d, yyyy")}
                            </p>
                          </CardContent>
                        </Card>
                      ))
                    : (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          No static address for {currency} yet.
                        </p>
                      )
                  }
                  {availableNetworks.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={handleGenerateStatic}
                      disabled={genStatic || !network}
                      className="w-full border-dashed text-xs h-9 gap-1.5"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      {genStatic
                        ? "Generating…"
                        : `Generate ${currency} Address${network ? ` (${network})` : ""}`
                      }
                    </Button>
                  )}
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
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </CardContent>
                </Card>
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
              {history.map(p => (
                <PaymentCard
                  key={p.id}
                  payment={p}
                  onVerify={handleVerify}
                  onOpenPayLink={openPayFrame}
                  verifying={verifying === p.track_id}
                  onClick={() => openPaymentDialog(p)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Payment overlay ── */}
      <AnimatePresence>
        {showPayFrame && payLink && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-50 bg-background flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background shrink-0">
              <p className="font-semibold text-sm">Payment Created</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => { setShowPayFrame(false); loadHistory(); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-5">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Coins className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-lg font-bold">Invoice Ready</p>
                <p className="text-sm text-muted-foreground">
                  Tap the button below to open the secure payment page.
                </p>
              </div>

              <div className="w-full space-y-3 max-w-xs">
                <Button
                  className="w-full gap-2 h-12 text-base font-semibold"
                  onClick={() => {
                    const tg = (window as any).Telegram?.WebApp;
                    if (tg?.openLink) {
                      tg.openLink(payLink, { try_instant_view: false });
                    } else {
                      window.open(payLink, "_blank");
                    }
                  }}
                >
                  <QrCode className="h-5 w-5" />
                  Open Payment Page
                </Button>

                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    setShowPayFrame(false);
                    if (trackId) handleVerify(trackId);
                    loadHistory();
                  }}
                >
                  <Check className="h-4 w-4" />
                  I've Paid — Check Status
                </Button>

                <Button
                  variant="ghost"
                  className="w-full gap-2 text-xs text-muted-foreground"
                  onClick={() => {
                    navigator.clipboard.writeText(payLink).catch(() => {});
                    toast.success("Payment link copied");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy Payment Link
                </Button>
              </div>

              {trackId && (
                <p className="text-[10px] text-muted-foreground/50 font-mono">
                  Track ID: {trackId}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Payment detail dialog ── */}
      <PaymentDialog
        payment={selectedPayment}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onVerify={handleVerify}
        onOpen={openPayFrame}
        verifying={!!(selectedPayment && verifying === selectedPayment.track_id)}
      />
    </Layout>
  );
}
