import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatShortIST } from "@/lib/date";
import {
  Crown, Sparkles, Zap, RefreshCw, Gift, XCircle,
  ChevronDown, ChevronUp, Plus, Loader2, Users, Trash2,
} from "lucide-react";

type PremiumSub = {
  id: number; telegram_id: string; amount_usd: number;
  expires_at: string; status: string; track_id: string;
  created_at: string; first_name?: string; username?: string;
};

type WidgetSub = {
  id: number; telegram_id: string; plan: string;
  stars_paid: number; expires_at: string; status: string;
  track_id: string; created_at: string;
  first_name?: string; username?: string;
};

type WidgetBoost = {
  id: number; telegram_id: string; boost_type: string;
  amount: number; payment_method: string; track_id: string;
  created_at?: string; first_name?: string; username?: string;
};

type TeamMember = {
  id: number; telegram_id: string; role: string; status: string;
  created_at: string; first_name?: string; username?: string;
};
type Team = {
  id: number; owner_telegram_id: string; name: string; invite_code: string;
  max_members: number; created_at: string; first_name?: string; username?: string;
  members: TeamMember[];
};

const BOOST_OPTIONS = [
  { key: "msgsPerDay", label: "+500 msgs/day", defaultAmount: 500 },
  { key: "widgets", label: "+2 widgets", defaultAmount: 2 },
  { key: "faq", label: "+5 FAQ items", defaultAmount: 5 },
  { key: "trainUrls", label: "+3 training URLs", defaultAmount: 3 },
  { key: "social", label: "+3 social links", defaultAmount: 3 },
];

export function AdminPlans() {
  const reqOpts = useApiAuth();
  const headers = reqOpts.headers as Record<string, string>;

  const [tab, setTab] = useState<"premium" | "widget" | "boosts" | "teams">("premium");
  const [loading, setLoading] = useState(true);

  const [premiumSubs, setPremiumSubs] = useState<PremiumSub[]>([]);
  const [widgetSubs, setWidgetSubs] = useState<WidgetSub[]>([]);
  const [boosts, setBoosts] = useState<WidgetBoost[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [addSeatsTeamId, setAddSeatsTeamId] = useState<number | null>(null);
  const [addSeatsAmount, setAddSeatsAmount] = useState("1");

  const [showGrantPremium, setShowGrantPremium] = useState(false);
  const [showGrantWidget, setShowGrantWidget] = useState(false);
  const [showGrantBoost, setShowGrantBoost] = useState(false);

  const [grantTgId, setGrantTgId] = useState("");
  const [grantDays, setGrantDays] = useState("30");
  const [grantPlan, setGrantPlan] = useState<"standard" | "pro">("pro");
  const [grantBoostKey, setGrantBoostKey] = useState("msgsPerDay");
  const [grantBoostAmount, setGrantBoostAmount] = useState("");
  const [granting, setGranting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, wRes, bRes, tRes] = await Promise.all([
        fetch(`${API_BASE}/admin/premium`, { headers }),
        fetch(`${API_BASE}/admin/widget-plans`, { headers }),
        fetch(`${API_BASE}/admin/widget-boosts`, { headers }),
        fetch(`${API_BASE}/admin/teams`, { headers }),
      ]);
      const [pData, wData, bData, tData] = await Promise.all([pRes.json(), wRes.json(), bRes.json(), tRes.json()]) as [
        { subscriptions?: PremiumSub[] },
        { subscriptions?: WidgetSub[] },
        { boosts?: WidgetBoost[] },
        Team[],
      ];
      if (pData.subscriptions) setPremiumSubs(pData.subscriptions);
      if (wData.subscriptions) setWidgetSubs(wData.subscriptions);
      if (bData.boosts) setBoosts(bData.boosts);
      if (Array.isArray(tData)) setTeams(tData);
    } catch {
      toast.error("Failed to load plans data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const grantPremium = async (): Promise<void> => {
    if (!grantTgId.trim()) { toast.error("Enter a Telegram ID"); return; }
    setGranting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/premium/grant`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_id: grantTgId.trim(), days: parseInt(grantDays) || 30 }),
      });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (d.ok) {
        toast.success(`Premium granted to ${grantTgId} for ${grantDays} days`);
        setGrantTgId(""); setShowGrantPremium(false);
        load();
      } else toast.error(d.error ?? "Failed");
    } catch { toast.error("Network error"); }
    finally { setGranting(false); }
  };

  const revokePremium = async (telegramId: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/premium/revoke`, {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_id: telegramId }),
      });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (d.ok) { toast.success("Premium revoked"); load(); }
      else toast.error(d.error ?? "Failed");
    } catch { toast.error("Network error"); }
  };

  const grantWidgetPlan = async (): Promise<void> => {
    if (!grantTgId.trim()) { toast.error("Enter a Telegram ID"); return; }
    setGranting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/widget-plan/grant`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_id: grantTgId.trim(), plan: grantPlan, days: parseInt(grantDays) || 30 }),
      });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (d.ok) {
        toast.success(`Widget ${grantPlan} granted to ${grantTgId}`);
        setGrantTgId(""); setShowGrantWidget(false);
        load();
      } else toast.error(d.error ?? "Failed");
    } catch { toast.error("Network error"); }
    finally { setGranting(false); }
  };

  const revokeWidgetPlan = async (telegramId: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/widget-plan/revoke`, {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_id: telegramId }),
      });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (d.ok) { toast.success("Widget plan revoked"); load(); }
      else toast.error(d.error ?? "Failed");
    } catch { toast.error("Network error"); }
  };

  const grantBoost = async (): Promise<void> => {
    if (!grantTgId.trim()) { toast.error("Enter a Telegram ID"); return; }
    const selectedBoost = BOOST_OPTIONS.find(b => b.key === grantBoostKey);
    const amount = grantBoostAmount ? parseInt(grantBoostAmount) : selectedBoost?.defaultAmount;
    setGranting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/boost/grant`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_id: grantTgId.trim(), boost_key: grantBoostKey, amount }),
      });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (d.ok) {
        toast.success(`Boost granted to ${grantTgId}`);
        setGrantTgId(""); setGrantBoostAmount(""); setShowGrantBoost(false);
        load();
      } else toast.error(d.error ?? "Failed");
    } catch { toast.error("Network error"); }
    finally { setGranting(false); }
  };

  const deleteTeam = async (teamId: number) => {
    try {
      const res = await fetch(`${API_BASE}/admin/team/${teamId}`, { method: "DELETE", headers });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (d.ok) { toast.success("Team deleted"); load(); }
      else toast.error(d.error ?? "Failed");
    } catch { toast.error("Network error"); }
  };

  const removeTeamMember = async (memberId: number) => {
    try {
      const res = await fetch(`${API_BASE}/admin/team/member/${memberId}`, { method: "DELETE", headers });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (d.ok) { toast.success("Member removed"); load(); }
      else toast.error(d.error ?? "Failed");
    } catch { toast.error("Network error"); }
  };

  const addSeats = async (teamId: number) => {
    const amt = parseInt(addSeatsAmount) || 1;
    try {
      const res = await fetch(`${API_BASE}/admin/team/${teamId}/seats`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt }),
      });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (d.ok) { toast.success(`Added ${amt} seats`); setAddSeatsTeamId(null); setAddSeatsAmount("1"); load(); }
      else toast.error(d.error ?? "Failed");
    } catch { toast.error("Network error"); }
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt + "Z") < new Date();

  const activePremium = premiumSubs.filter(s => s.status === "active" && !isExpired(s.expires_at));
  const activeWidget = widgetSubs.filter(s => s.status === "active" && !isExpired(s.expires_at));

  const tabItems = [
    { key: "premium" as const, label: "Premium", count: activePremium.length, icon: Crown },
    { key: "widget" as const, label: "Widget", count: activeWidget.length, icon: Sparkles },
    { key: "boosts" as const, label: "Boosts", count: boosts.length, icon: Zap },
    { key: "teams" as const, label: "Teams", count: teams.length, icon: Users },
  ];

  return (
    <Layout title="Plan Manager" backTo="/admin">
      <div className="h-full overflow-y-auto">
        <div className="p-4 space-y-4">

          <div className="flex gap-2">
            {tabItems.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${
                  tab === t.key
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-muted/30 text-muted-foreground border border-border hover:bg-muted/50"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                <Badge variant="outline" className="text-[10px] h-4 px-1 ml-0.5">{t.count}</Badge>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {tab === "premium" && `${premiumSubs.length} total, ${activePremium.length} active`}
              {tab === "widget" && `${widgetSubs.length} total, ${activeWidget.length} active`}
              {tab === "boosts" && `${boosts.length} total boosts granted`}
            </p>
            <button onClick={load} disabled={loading} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : (
            <>
              {tab === "premium" && (
                <div className="space-y-3">
                  <button
                    onClick={() => { setShowGrantPremium(!showGrantPremium); setShowGrantWidget(false); setShowGrantBoost(false); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
                  >
                    {showGrantPremium ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    Grant Premium
                  </button>

                  {showGrantPremium && (
                    <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                      <Input placeholder="Telegram ID" value={grantTgId} onChange={e => setGrantTgId(e.target.value)} className="h-9" />
                      <div className="flex gap-2">
                        <Input placeholder="Days (default 30)" value={grantDays} onChange={e => setGrantDays(e.target.value)} className="h-9 flex-1" type="number" />
                        <Button size="sm" onClick={grantPremium} disabled={granting} className="h-9">
                          {granting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4 mr-1" />}
                          Grant
                        </Button>
                      </div>
                    </div>
                  )}

                  {premiumSubs.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Crown className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No premium subscriptions yet</p>
                    </div>
                  ) : premiumSubs.map(sub => {
                    const expired = isExpired(sub.expires_at);
                    const isActive = sub.status === "active" && !expired;
                    return (
                      <div key={sub.id} className="p-3 rounded-xl border border-border bg-card space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {sub.first_name || sub.telegram_id}
                              {sub.username && <span className="text-muted-foreground font-normal ml-1">@{sub.username}</span>}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono">{sub.telegram_id}</p>
                          </div>
                          <Badge
                            variant={isActive ? "default" : "outline"}
                            className={`text-[10px] shrink-0 ${isActive ? "bg-primary/20 text-primary border-primary/30" : expired ? "text-white/40" : ""}`}
                          >
                            {sub.status === "revoked" ? "Revoked" : expired ? "Expired" : "Active"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Expires: {formatShortIST(sub.expires_at)}</span>
                          <span>Created: {formatShortIST(sub.created_at)}</span>
                        </div>
                        {isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-8 text-xs text-white/50 border-white/10 hover:text-white/70"
                            onClick={() => revokePremium(sub.telegram_id)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Revoke Premium
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {tab === "widget" && (
                <div className="space-y-3">
                  <button
                    onClick={() => { setShowGrantWidget(!showGrantWidget); setShowGrantPremium(false); setShowGrantBoost(false); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
                  >
                    {showGrantWidget ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    Grant Widget Plan
                  </button>

                  {showGrantWidget && (
                    <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                      <Input placeholder="Telegram ID" value={grantTgId} onChange={e => setGrantTgId(e.target.value)} className="h-9" />
                      <div className="flex gap-2">
                        <select
                          value={grantPlan}
                          onChange={e => setGrantPlan(e.target.value as "standard" | "pro")}
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm flex-1"
                        >
                          <option value="standard">Standard</option>
                          <option value="pro">Pro</option>
                        </select>
                        <Input placeholder="Days" value={grantDays} onChange={e => setGrantDays(e.target.value)} className="h-9 w-20" type="number" />
                      </div>
                      <Button size="sm" onClick={grantWidgetPlan} disabled={granting} className="w-full h-9">
                        {granting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4 mr-1" />}
                        Grant Plan
                      </Button>
                    </div>
                  )}

                  {widgetSubs.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No widget plans yet</p>
                    </div>
                  ) : widgetSubs.map(sub => {
                    const expired = isExpired(sub.expires_at);
                    const isActive = sub.status === "active" && !expired;
                    return (
                      <div key={sub.id} className="p-3 rounded-xl border border-border bg-card space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {sub.first_name || sub.telegram_id}
                              {sub.username && <span className="text-muted-foreground font-normal ml-1">@{sub.username}</span>}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono">{sub.telegram_id}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className="text-[10px] capitalize">{sub.plan}</Badge>
                            <Badge
                              variant={isActive ? "default" : "outline"}
                              className={`text-[10px] ${isActive ? "bg-primary/20 text-primary border-primary/30" : expired ? "text-white/40" : ""}`}
                            >
                              {sub.status === "revoked" ? "Revoked" : expired ? "Expired" : "Active"}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Expires: {formatShortIST(sub.expires_at)}</span>
                          <span>{sub.stars_paid > 0 ? `${sub.stars_paid} Stars` : "Manual"}</span>
                        </div>
                        {isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-8 text-xs text-white/50 border-white/10 hover:text-white/70"
                            onClick={() => revokeWidgetPlan(sub.telegram_id)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Revoke Widget Plan
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {tab === "boosts" && (
                <div className="space-y-3">
                  <button
                    onClick={() => { setShowGrantBoost(!showGrantBoost); setShowGrantPremium(false); setShowGrantWidget(false); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
                  >
                    {showGrantBoost ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    Grant Boost
                  </button>

                  {showGrantBoost && (
                    <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                      <Input placeholder="Telegram ID" value={grantTgId} onChange={e => setGrantTgId(e.target.value)} className="h-9" />
                      <select
                        value={grantBoostKey}
                        onChange={e => {
                          setGrantBoostKey(e.target.value);
                          setGrantBoostAmount("");
                        }}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {BOOST_OPTIONS.map(b => (
                          <option key={b.key} value={b.key}>{b.label} (default: {b.defaultAmount})</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <Input
                          placeholder={`Amount (default: ${BOOST_OPTIONS.find(b => b.key === grantBoostKey)?.defaultAmount})`}
                          value={grantBoostAmount}
                          onChange={e => setGrantBoostAmount(e.target.value)}
                          className="h-9 flex-1"
                          type="number"
                        />
                        <Button size="sm" onClick={grantBoost} disabled={granting} className="h-9">
                          {granting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
                          Grant
                        </Button>
                      </div>
                    </div>
                  )}

                  {boosts.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Zap className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No boosts granted yet</p>
                    </div>
                  ) : boosts.map(b => (
                    <div key={b.id} className="p-3 rounded-xl border border-border bg-card">
                      <div className="flex items-center justify-between mb-1">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {b.first_name || b.telegram_id}
                            {b.username && <span className="text-muted-foreground font-normal ml-1">@{b.username}</span>}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                          {b.payment_method}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">
                          +{b.amount} {b.boost_type}
                        </span>
                        {b.created_at && <span>{formatShortIST(b.created_at)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "teams" && (
            <>
              <div className="space-y-3">
                {teams.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No teams created yet</p>
                  </div>
                ) : teams.map(t => (
                  <div key={t.id} className="p-3 rounded-xl border border-border bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Owner: {t.first_name || t.owner_telegram_id}
                          {t.username && ` @${t.username}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px]">
                          {t.members.length}/{t.max_members} seats
                        </Badge>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteTeam(t.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-3">
                      <span>Code: <code className="font-mono text-foreground">{t.invite_code}</code></span>
                      <span>Created: {formatShortIST(t.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {addSeatsTeamId === t.id ? (
                        <div className="flex gap-1 items-center">
                          <Input
                            type="number" min="1" max="20" value={addSeatsAmount}
                            onChange={e => setAddSeatsAmount(e.target.value)}
                            className="h-7 w-16 text-xs"
                          />
                          <Button size="sm" className="h-7 text-[10px]" onClick={() => addSeats(t.id)}>Add</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setAddSeatsTeamId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => setAddSeatsTeamId(t.id)}>
                          <Plus className="h-3 w-3" /> Add Seats
                        </Button>
                      )}
                    </div>
                    {t.members.length > 0 ? (
                      <div className="space-y-1.5 pt-1">
                        {t.members.map(m => (
                          <div key={m.id} className="flex items-center gap-2 bg-muted/30 rounded-lg px-2.5 py-1.5">
                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                              {(m.first_name || m.telegram_id || "?")[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-medium truncate">
                                {m.first_name || m.telegram_id}
                                {m.username && <span className="text-muted-foreground ml-1">@{m.username}</span>}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-[8px] px-1 py-0">{m.status}</Badge>
                            <button onClick={() => removeTeamMember(m.id)} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground italic">No members</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
