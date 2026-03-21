import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, DollarSign, TrendingUp, CreditCard } from "lucide-react";
import { format } from "date-fns";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/miniapp", "") + "/api";

type Donation = {
  id: number; amount: number; currency: string; status: string;
  track_id: string; tx_id?: string; created_at: string;
  first_name: string; username?: string; telegram_id: string;
};

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  paid:       { label: "Paid",       className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" },
  confirming: { label: "Confirming", className: "border-blue-500/30 bg-blue-500/10 text-blue-600" },
  expired:    { label: "Expired",    className: "border-red-500/30 bg-red-500/10 text-red-500" },
  failed:     { label: "Failed",     className: "border-red-500/30 bg-red-500/10 text-red-500" },
  pending:    { label: "Pending",    className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-600" },
};

const STATUSES = ["all", "paid", "pending", "confirming", "expired"];

export function AdminDonations() {
  const reqOpts = useApiAuth();
  const headers = reqOpts.headers as Record<string, string>;
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = () => {
    setLoading(true);
    fetch(`${API_BASE}/donations/admin/all`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setDonations(d))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? donations : donations.filter(d => d.status === filter);
  const totalPaid = donations.filter(d => d.status === "paid").reduce((s, d) => s + (d.amount ?? 0), 0);
  const paidCount = donations.filter(d => d.status === "paid").length;

  return (
    <Layout title="Donations">
      <div className="h-full overflow-y-auto p-4 pb-20 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: CreditCard, label: "Total", value: donations.length.toString(), color: "text-foreground" },
            { icon: TrendingUp, label: "Paid", value: paidCount.toString(), color: "text-emerald-600" },
            { icon: DollarSign, label: "Revenue", value: `$${totalPaid.toFixed(0)}`, color: "text-emerald-600" },
          ].map(({ icon: Icon, label, value, color }) => (
            <Card key={label}>
              <CardContent className="p-3 flex flex-col items-center justify-center gap-1">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 flex-1 overflow-x-auto no-scrollbar">
            {STATUSES.map(s => (
              <Button
                key={s}
                variant={filter === s ? "default" : "outline"}
                size="sm"
                className="whitespace-nowrap text-xs h-7 px-2.5 rounded-full shrink-0"
                onClick={() => setFilter(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Separator />

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            No {filter === "all" ? "" : filter} donations yet.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(d => {
              const status = STATUS_MAP[d.status] ?? STATUS_MAP.pending;
              return (
                <Card key={d.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-1.5">
                      <div>
                        <p className="font-semibold text-sm">
                          ${d.amount?.toFixed(2)}
                          <span className="text-muted-foreground font-normal ml-1 text-xs">{d.currency}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {d.first_name}{d.username ? ` @${d.username}` : ` #${d.telegram_id}`}
                        </p>
                      </div>
                      <Badge variant="outline" className={status.className}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(d.created_at), "MMM d, yyyy · HH:mm")}
                      </p>
                      {d.tx_id && (
                        <p className="text-xs text-muted-foreground font-mono">
                          TX: {d.tx_id.slice(0, 10)}…
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
