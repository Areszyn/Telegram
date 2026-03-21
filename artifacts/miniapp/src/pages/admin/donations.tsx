import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/payments/StatusBadge";
import { AdminPaymentDialog, type AdminDonation } from "@/components/payments/AdminPaymentDialog";
import { RefreshCw, DollarSign, TrendingUp, CreditCard } from "lucide-react";
import { format } from "date-fns";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/miniapp", "") + "/api";

const TABS = [
  { value: "all",        label: "All" },
  { value: "paid",       label: "Paid" },
  { value: "pending",    label: "Pending" },
  { value: "confirming", label: "Confirming" },
  { value: "expired",    label: "Expired" },
];

const avatarColors = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500",
  "bg-orange-500", "bg-pink-500", "bg-cyan-500",
];
function avatarColor(name?: string) {
  return avatarColors[(name?.charCodeAt(0) ?? 0) % avatarColors.length];
}
function getInitials(name?: string) {
  return name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";
}

export function AdminDonations() {
  const reqOpts = useApiAuth();
  const headers = reqOpts.headers as Record<string, string>;
  const [donations, setDonations] = useState<AdminDonation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminDonation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = () => {
    setLoading(true);
    fetch(`${API_BASE}/donations/admin/all`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setDonations(d))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const totalPaid = donations.filter(d => d.status === "paid").reduce((s, d) => s + (d.amount ?? 0), 0);
  const paidCount = donations.filter(d => d.status === "paid").length;

  const openDialog = (d: AdminDonation) => { setSelected(d); setDialogOpen(true); };

  const DonationRow = ({ d }: { d: AdminDonation }) => (
    <Card
      className="cursor-pointer hover:bg-muted/40 active:bg-muted/60 transition-colors"
      onClick={() => openDialog(d)}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className={`h-9 w-9 shrink-0 ${avatarColor(d.first_name)}`}>
            <AvatarFallback className={`text-white font-semibold text-sm ${avatarColor(d.first_name)}`}>
              {getInitials(d.first_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-sm truncate">{d.first_name}</span>
              {d.username && <span className="text-xs text-muted-foreground shrink-0">@{d.username}</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(d.created_at), "MMM d, yyyy · HH:mm")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <p className="font-semibold text-sm">
              ${d.amount?.toFixed(2)}
              <span className="text-muted-foreground font-normal text-xs ml-1">{d.currency}</span>
            </p>
            <StatusBadge status={d.status} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const SkeletonRow = () => (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-40" />
        </div>
        <div className="space-y-1.5 items-end flex flex-col">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Layout title="Donations">
      <div className="h-full flex flex-col overflow-hidden">

        {/* ── Stats ── */}
        <div className="px-4 pt-4 pb-3 grid grid-cols-3 gap-3 shrink-0">
          {[
            { icon: CreditCard, label: "Total",   value: donations.length.toString(), cls: "text-foreground" },
            { icon: TrendingUp, label: "Paid",    value: paidCount.toString(),         cls: "text-emerald-600" },
            { icon: DollarSign, label: "Revenue", value: `$${totalPaid.toFixed(0)}`,  cls: "text-emerald-600" },
          ].map(({ icon: Icon, label, value, cls }) => (
            <Card key={label}>
              <CardContent className="p-3 flex flex-col items-center gap-1.5">
                <Icon className={`h-4 w-4 ${cls}`} />
                <p className={`text-xl font-bold leading-none ${cls}`}>{value}</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Filter tabs + refresh ── */}
        <Tabs defaultValue="all" className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 pb-3 shrink-0">
            <TabsList className="flex-1 h-8 gap-0.5">
              {TABS.map(t => (
                <TabsTrigger key={t.value} value={t.value} className="flex-1 text-[11px] h-7 px-1.5">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {TABS.map(t => {
            const items = t.value === "all"
              ? donations
              : donations.filter(d => d.status === t.value);

            return (
              <TabsContent
                key={t.value}
                value={t.value}
                className="flex-1 overflow-y-auto px-4 pb-4 mt-0 space-y-2"
              >
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
                  </div>
                ) : !items.length ? (
                  <div className="py-16 text-center text-muted-foreground text-sm">
                    No {t.value === "all" ? "" : t.value + " "}donations yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map(d => <DonationRow key={d.id} d={d} />)}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      <AdminPaymentDialog
        donation={selected}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </Layout>
  );
}
