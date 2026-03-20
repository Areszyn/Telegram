import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { Loader2, DollarSign, RefreshCw, Filter } from "lucide-react";
import { format } from "date-fns";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/miniapp", "") + "/api";

type Donation = {
  id: number; amount: number; currency: string; status: string;
  track_id: string; tx_id?: string; created_at: string;
  first_name: string; username?: string; telegram_id: string;
};

function statusColor(s: string) {
  if (s === "paid") return "bg-green-500/20 text-green-400 border-green-500/30";
  if (s === "confirming") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (s === "expired" || s === "failed") return "bg-red-500/20 text-red-400 border-red-500/30";
  return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
}

export function AdminDonations() {
  const reqOpts = useApiAuth();
  const headers = reqOpts.headers as Record<string, string>;
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const load = () => {
    setLoading(true);
    fetch(`${API_BASE}/donations/admin/all`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setDonations(d))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? donations : donations.filter(d => d.status === filter);

  const totalPaid = donations
    .filter(d => d.status === "paid")
    .reduce((s, d) => s + (d.amount || 0), 0);

  const statuses = ["all", "paid", "pending", "confirming", "expired"];

  return (
    <Layout title="Donations">
      <div className="h-full overflow-y-auto p-4 pb-20 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border/50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{donations.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="bg-card border border-border/50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{donations.filter(d => d.status === "paid").length}</p>
            <p className="text-xs text-muted-foreground">Paid</p>
          </div>
          <div className="bg-card border border-border/50 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-green-400">${totalPaid.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </div>
        </div>

        {/* Filter + Refresh */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1">
            {statuses.map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${filter === s ? 'bg-primary/10 border-primary text-primary' : 'border-border/50 text-muted-foreground'}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors shrink-0">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-muted-foreground" /></div>
        ) : !filtered.length ? (
          <div className="bg-card border border-border/50 rounded-2xl p-10 text-center text-muted-foreground text-sm">
            No {filter === "all" ? "" : filter} donations yet.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(d => (
              <div key={d.id} className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-base">${d.amount?.toFixed(2)} <span className="text-xs text-muted-foreground">{d.currency}</span></p>
                    <p className="text-sm font-medium text-foreground/80">{d.first_name} {d.username ? `@${d.username}` : `#${d.telegram_id}`}</p>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase border ${statusColor(d.status)}`}>
                    {d.status}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{format(new Date(d.created_at), 'MMM d, yyyy · HH:mm')}</p>
                  {d.tx_id && <p className="text-xs text-muted-foreground font-mono">TX: {d.tx_id.slice(0, 12)}…</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
