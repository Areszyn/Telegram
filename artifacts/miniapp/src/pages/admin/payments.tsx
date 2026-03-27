import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { API_BASE } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatShortIST } from "@/lib/date";
import { Crown, Zap, Sparkles, DollarSign, CreditCard, ChevronDown, ChevronUp, RefreshCw, User } from "lucide-react";
import { Button } from "@/components/ui/button";

type BaseFields = { id: number; telegram_id: string; user_name: string; username: string };

type PremiumRow = BaseFields & {
  stars_paid: number; amount_usd: number; expires_at: string;
  status: string; track_id: string | null; created_at: string;
};
type WidgetSubRow = BaseFields & {
  plan: string; stars_paid: number; expires_at: string;
  status: string; track_id: string | null; created_at: string;
};
type WidgetPlanRow = BaseFields & {
  plan: string; order_id: string; track_id: string | null;
  amount_usd: number; pay_currency: string | null; pay_amount: number;
  status: string; credited: number; created_at: string;
};
type BoostRow = BaseFields & {
  boost_type: string; amount: number; payment_method: string;
  track_id: string | null; created_at: string; expires_at: string | null;
};
type DonationRow = BaseFields & {
  amount: number; currency: string; status: string;
  pay_currency: string; pay_amount: number; network: string;
  order_id: string; track_id: string; created_at: string;
};

type PaymentData = {
  premium: PremiumRow[];
  widgetPlans: WidgetPlanRow[];
  widgetSubs: WidgetSubRow[];
  boosts: BoostRow[];
  donations: DonationRow[];
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  paid: "bg-green-500/20 text-green-400 border-green-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  confirming: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  expired: "bg-red-500/20 text-red-400 border-red-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`text-[9px] ${STATUS_COLORS[status] ?? ""}`}>
      {status}
    </Badge>
  );
}

function UserLabel({ p }: { p: BaseFields }) {
  const name = p.user_name || "Unknown";
  const uname = p.username ? `@${p.username}` : p.telegram_id || "";
  return (
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
      <User className="h-3 w-3" />
      <span className="font-medium text-foreground/80">{name}</span>
      <span className="opacity-60">{uname}</span>
    </div>
  );
}

const BOOST_LABELS: Record<string, string> = {
  msgsPerDay: "Messages/day", widgets: "Widgets", faq: "FAQ items",
  trainUrls: "Training URLs", social: "Social links",
};

const TABS = ["Premium", "Widget Plans", "Boosts", "Donations"] as const;
type Tab = typeof TABS[number];

export function AdminPayments() {
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  const [data, setData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("Premium");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/payments/all`, { headers });
      const d = await res.json() as PaymentData & { ok: boolean };
      if (d.ok) setData(d);
      else toast.error("Failed to load payments");
    } catch { toast.error("Network error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggle = (key: string) => setExpanded(p => ({ ...p, [key]: !p[key] }));

  const counts = data ? {
    Premium: data.premium.length,
    "Widget Plans": data.widgetPlans.length + data.widgetSubs.length,
    Boosts: data.boosts.length,
    Donations: data.donations.length,
  } : {};

  return (
    <Layout title="All Payments" backTo="/admin/plans">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">All Payments</h2>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                tab === t ? "bg-white text-black" : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {t} {counts[t] ? `(${counts[t]})` : ""}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : !data ? (
          <p className="text-xs text-muted-foreground text-center py-8">No data</p>
        ) : (
          <>
            {tab === "Premium" && (
              <div className="space-y-2">
                {data.premium.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No premium payments</p>}
                {data.premium.map(p => (
                  <div key={p.id} className="bg-card border border-border rounded-xl p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Crown className="h-3.5 w-3.5 text-yellow-400" />
                        <span className="text-[11px] font-semibold">Premium</span>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                    <UserLabel p={p} />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{p.stars_paid} Stars (${p.amount_usd})</span>
                      <span>{formatShortIST(p.created_at)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Expires: {formatShortIST(p.expires_at)}</p>
                    {p.track_id && <p className="text-[9px] text-muted-foreground/60 truncate">Track: {p.track_id}</p>}
                  </div>
                ))}
              </div>
            )}

            {tab === "Widget Plans" && (
              <div className="space-y-2">
                <h3 className="text-[11px] font-semibold text-muted-foreground">Star Subscriptions ({data.widgetSubs.length})</h3>
                {data.widgetSubs.map(s => (
                  <div key={s.id} className="bg-card border border-border rounded-xl p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-blue-400" />
                        <span className="text-[11px] font-semibold capitalize">{s.plan}</span>
                      </div>
                      <StatusBadge status={s.status} />
                    </div>
                    <UserLabel p={s} />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{s.stars_paid} Stars</span>
                      <span>Exp: {formatShortIST(s.expires_at)}</span>
                    </div>
                  </div>
                ))}

                <h3 className="text-[11px] font-semibold text-muted-foreground pt-2">Crypto Payments ({data.widgetPlans.length})</h3>
                {data.widgetPlans.map(wp => (
                  <div key={wp.id} className="bg-card border border-border rounded-xl p-3">
                    <button onClick={() => toggle(`wp-${wp.id}`)} className="w-full flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-orange-400" />
                        <span className="text-[11px] font-semibold capitalize">{wp.plan.replace("boost:", "Boost: ")}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={wp.status} />
                        {expanded[`wp-${wp.id}`] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </div>
                    </button>
                    <UserLabel p={wp} />
                    {expanded[`wp-${wp.id}`] && (
                      <div className="mt-2 text-[10px] text-muted-foreground space-y-0.5">
                        <p>Amount: ${wp.amount_usd} USD</p>
                        {wp.pay_currency && <p>Paid: {wp.pay_amount} {wp.pay_currency}</p>}
                        <p>Date: {formatShortIST(wp.created_at)}</p>
                        <p>Credited: {wp.credited ? "Yes" : "No"}</p>
                        {wp.track_id && <p className="truncate">Track: {wp.track_id}</p>}
                        {wp.order_id && <p className="truncate">Order: {wp.order_id}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === "Boosts" && (
              <div className="space-y-2">
                {data.boosts.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No boosts</p>}
                {data.boosts.map(b => {
                  const expiresAt = b.expires_at;
                  const isExpired = expiresAt && new Date(expiresAt + "Z") < new Date();
                  return (
                    <div key={b.id} className={`bg-card border rounded-xl p-3 space-y-1 ${isExpired ? "border-red-500/20 opacity-60" : "border-border"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
                          <span className="text-[11px] font-semibold">+{b.amount} {BOOST_LABELS[b.boost_type] ?? b.boost_type}</span>
                        </div>
                        <Badge variant="outline" className={`text-[9px] ${isExpired ? "text-red-400 border-red-500/30" : "text-green-400 border-green-500/30"}`}>
                          {isExpired ? "Expired" : "Active"}
                        </Badge>
                      </div>
                      <UserLabel p={b} />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>via {b.payment_method}</span>
                        <span>{formatShortIST(b.created_at)}</span>
                      </div>
                      {expiresAt && (
                        <p className={`text-[10px] ${isExpired ? "text-red-400/70" : "text-muted-foreground"}`}>
                          {isExpired ? "Expired" : "Expires"}: {formatShortIST(expiresAt)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "Donations" && (
              <div className="space-y-2">
                {data.donations.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No donations</p>}
                {data.donations.map(d => (
                  <div key={d.id} className="bg-card border border-border rounded-xl p-3">
                    <button onClick={() => toggle(`don-${d.id}`)} className="w-full flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-green-400" />
                        <span className="text-[11px] font-semibold">${d.amount} {d.currency}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={d.status} />
                        {expanded[`don-${d.id}`] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </div>
                    </button>
                    <UserLabel p={d} />
                    {expanded[`don-${d.id}`] && (
                      <div className="mt-2 text-[10px] text-muted-foreground space-y-0.5">
                        {d.pay_currency && <p>Paid: {d.pay_amount} {d.pay_currency}</p>}
                        {d.network && <p>Network: {d.network}</p>}
                        <p>Date: {formatShortIST(d.created_at)}</p>
                        {d.track_id && <p className="truncate">Track: {d.track_id}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
