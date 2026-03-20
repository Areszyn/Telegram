import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { Loader2, Coins, History, Copy, Check, X, QrCode, Wallet, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/miniapp", "") + "/api";

type Coin = { symbol: string; network?: string; networks?: string[] };
type Donation = { id: number; amount: number; currency: string; status: string; track_id: string; pay_link?: string; created_at: string };
type StaticAddr = { id: number; address: string; currency: string; network: string; created_at: string };

function statusColor(s: string) {
  if (s === "paid") return "bg-green-500/20 text-green-400 border-green-500/30";
  if (s === "confirming") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (s === "expired" || s === "failed") return "bg-red-500/20 text-red-400 border-red-500/30";
  return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
    >
      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
    </button>
  );
}

export function DonatePage() {
  const reqOpts = useApiAuth();
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
  const historyTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const headers = reqOpts.headers as Record<string, string>;

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
          setCoins([{ symbol: "USDT" }, { symbol: "BTC" }, { symbol: "ETH" }, { symbol: "LTC" }, { symbol: "TRX" }]);
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
    try {
      const res = await fetch(`${API_BASE}/donations/create`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num, currency }),
      });
      const data = await res.json();
      if (data.payLink) {
        setPayLink(data.payLink);
        setTrackId(data.trackId ?? null);
        setShowPayFrame(true);
        loadHistory();
      }
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
      <div className="h-full overflow-y-auto p-4 pb-24 space-y-5">

        {/* Donation Form */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-primary/20 p-2.5 rounded-xl">
              <Coins className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Make a Donation</h2>
              <p className="text-xs text-muted-foreground">Powered by OxaPay · No redirects</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Amount */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-background border-2 border-border/50 rounded-xl pl-8 pr-4 py-3 text-lg font-semibold focus:outline-none focus:border-primary transition-colors"
                  placeholder="10.00"
                  min="1"
                />
              </div>
              <div className="flex gap-2 mt-2">
                {[5, 10, 25, 50].map(v => (
                  <button key={v} onClick={() => setAmount(String(v))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${amount === String(v) ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground hover:border-border'}`}>
                    ${v}
                  </button>
                ))}
              </div>
            </div>

            {/* Currency */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Currency</label>
              {loadingCoins ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading currencies...</div>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                  {coins.slice(0, 12).map(c => (
                    <button key={c.symbol} onClick={() => selectCurrency(c)}
                      className={`py-2 rounded-xl font-semibold text-xs border-2 transition-all ${currency === c.symbol ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 bg-background text-muted-foreground hover:border-border'}`}>
                      {c.symbol}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Network selector */}
            {availableNetworks.length > 1 && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Network</label>
                <div className="flex gap-2 flex-wrap">
                  {availableNetworks.map(n => (
                    <button key={n} onClick={() => setNetwork(n)}
                      className={`px-3 py-1.5 rounded-lg font-medium text-xs border transition-all ${network === n ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground hover:border-border'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Donate Button */}
            <button onClick={handleDonate} disabled={creating || parseFloat(amount) <= 0}
              className="w-full bg-gradient-to-r from-primary to-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/25 hover:opacity-90 transition-all disabled:opacity-50 flex justify-center items-center gap-2">
              {creating ? <><Loader2 className="w-5 h-5 animate-spin" /> Creating Invoice...</> : `Donate $${amount || '0'} in ${currency}`}
            </button>
          </div>
        </div>

        {/* Static Addresses */}
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
          <button onClick={() => setShowStatic(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left">
            <div className="flex items-center gap-3">
              <div className="bg-purple-500/20 p-2 rounded-lg">
                <Wallet className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="font-semibold text-sm">Static Crypto Address</p>
                <p className="text-xs text-muted-foreground">Get a permanent address for {currency}</p>
              </div>
            </div>
            {showStatic ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {showStatic && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                className="overflow-hidden border-t border-border/50">
                <div className="p-5 space-y-4">
                  {staticAddrs.filter(a => a.currency === currency).length > 0 ? (
                    <div className="space-y-3">
                      {staticAddrs.filter(a => a.currency === currency).map(a => (
                        <div key={a.id} className="bg-background border border-border/50 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-primary">{a.currency}</span>
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{a.network}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CopyButton text={a.address} />
                              <button onClick={() => handleRevokeStatic(a.address)}
                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors">
                                <X className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </div>
                          <p className="font-mono text-xs text-foreground/80 break-all">{a.address}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">No static address for {currency} yet.</p>
                  )}

                  {availableNetworks.length > 0 && (
                    <button onClick={handleGenerateStatic} disabled={genStatic || !network}
                      className="w-full py-2.5 rounded-xl border-2 border-dashed border-primary/30 text-primary text-sm font-semibold hover:bg-primary/5 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                      {genStatic ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                      Generate {currency} Address {network ? `(${network})` : ""}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* History */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-bold">Recent Donations</h3>
            </div>
            <button onClick={loadHistory} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {loadingHistory ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !history.length ? (
            <div className="bg-card border border-border/50 rounded-2xl p-8 text-center text-muted-foreground text-sm shadow-sm">No donations yet.</div>
          ) : (
            <div className="space-y-3">
              {history.map(d => (
                <div key={d.id} className="bg-card border border-border/50 rounded-xl p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="font-bold">${d.amount?.toFixed(2)} <span className="text-xs text-muted-foreground font-normal">{d.currency}</span></p>
                    <p className="text-xs text-muted-foreground">{format(new Date(d.created_at), 'MMM d, yyyy · HH:mm')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.status === 'pending' && d.track_id && (
                      <button onClick={() => handleVerify(d.track_id)} disabled={verifying === d.track_id}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                        {verifying === d.track_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                    )}
                    {d.status === 'pending' && d.pay_link && (
                      <button onClick={() => { setPayLink(d.pay_link!); setTrackId(d.track_id); setShowPayFrame(true); }}
                        className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">
                        Open
                      </button>
                    )}
                    <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase border ${statusColor(d.status)}`}>
                      {d.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* White-Label Payment iframe Modal */}
      <AnimatePresence>
        {showPayFrame && payLink && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border/50">
              <h2 className="font-bold text-base">Complete Payment</h2>
              <button onClick={() => { setShowPayFrame(false); loadHistory(); }}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe
              src={payLink}
              className="flex-1 w-full border-0 bg-white"
              allow="payment; clipboard-write"
              title="OxaPay Payment"
            />
            <div className="px-4 py-3 bg-card border-t border-border/50">
              <button onClick={() => { setShowPayFrame(false); if (trackId) handleVerify(trackId); }}
                className="w-full py-3 rounded-xl bg-primary/10 text-primary font-semibold text-sm hover:bg-primary/20 transition-colors flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" /> I've Paid — Check Status
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
