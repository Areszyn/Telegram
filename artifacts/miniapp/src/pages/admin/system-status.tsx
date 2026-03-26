import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth, useTelegram } from "@/lib/telegram-context";
import { API_BASE } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Activity, Server, Database, Bot, Globe, Radio,
  RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle,
  Wifi, HardDrive, Loader2, Shield,
} from "lucide-react";

type ServiceStatus = {
  name: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "checking" | "online" | "offline" | "degraded";
  latency?: number;
  details?: string;
  error?: string;
};

export function SystemStatus() {
  const { profile } = useTelegram();
  const isAdmin = profile?.is_admin === true;
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<{
    url?: string;
    pending?: number;
    lastError?: string;
    lastErrorDate?: number;
  } | null>(null);
  const [dbStats, setDbStats] = useState<{
    users?: number;
    messages?: number;
    donations?: number;
    groups?: number;
    premium?: number;
  } | null>(null);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [dbStatsError, setDbStatsError] = useState<string | null>(null);

  const checkService = async (
    name: string,
    url: string,
    icon: React.ComponentType<{ className?: string }>,
    fetchOpts?: RequestInit,
  ): Promise<ServiceStatus> => {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { ...fetchOpts, signal: controller.signal });
      clearTimeout(timeout);
      const latency = Date.now() - start;
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { name, url, icon, status: "online", latency, details: data.bot || data.db || data.runtime || data.status || "OK" };
      }
      return { name, url, icon, status: "degraded", latency, error: `HTTP ${res.status}` };
    } catch (e) {
      return { name, url, icon, status: "offline", latency: Date.now() - start, error: e instanceof Error ? e.message : "Unknown error" };
    }
  };

  const runChecks = useCallback(async () => {
    setChecking(true);

    const checks = await Promise.all([
      checkService("Cloudflare Worker (API)", `${API_BASE}/health`, Server),
      checkService("D1 Database", `${API_BASE}/health/db`, Database),
      checkService("Telegram Bot API", `${API_BASE}/health/bot`, Bot),
      checkService("MTProto Backend (Koyeb)", `${API_BASE}/health/mtproto`, Globe),
      checkService("Cloudflare Pages", "https://lifegram-miniapp.pages.dev/miniapp/", Radio),
    ]);

    setServices(checks);
    setLastCheck(new Date());

    if (isAdmin) {
      setWebhookError(null);
      setDbStatsError(null);

      try {
        const whRes = await fetch(`${API_BASE}/admin/webhook-info`, { headers });
        if (whRes.ok) {
          const whData = await whRes.json();
          setWebhookInfo(whData);
        } else {
          setWebhookError(`HTTP ${whRes.status}`);
        }
      } catch (e) {
        setWebhookError(e instanceof Error ? e.message : "Failed to load");
      }

      try {
        const statsRes = await fetch(`${API_BASE}/admin/db-stats`, { headers });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setDbStats(statsData);
        } else {
          setDbStatsError(`HTTP ${statsRes.status}`);
        }
      } catch (e) {
        setDbStatsError(e instanceof Error ? e.message : "Failed to load");
      }
    }

    setChecking(false);
  }, [headers, isAdmin]);

  useEffect(() => { runChecks(); }, []);

  const overallStatus = services.length === 0
    ? "checking"
    : services.every(s => s.status === "online")
      ? "online"
      : services.some(s => s.status === "offline")
        ? "offline"
        : "degraded";

  const statusConfig = {
    checking: { label: "Checking...", color: "text-muted-foreground", bg: "bg-muted", icon: Loader2 },
    online: { label: "All Systems Operational", color: "text-white/70", bg: "bg-white/5", icon: CheckCircle },
    degraded: { label: "Partial Outage", color: "text-white/50", bg: "bg-white/5", icon: AlertTriangle },
    offline: { label: "Major Outage", color: "text-white/40", bg: "bg-white/5", icon: XCircle },
  };

  const overall = statusConfig[overallStatus];

  return (
    <Layout title="System Status" backTo={isAdmin ? "/admin" : "/"}>
      <div className="h-full overflow-y-auto">
        <div className="p-4 space-y-4">
          <div className={`rounded-2xl border border-border p-4 ${overall.bg}`}>
            <div className="flex items-center gap-3">
              <overall.icon className={`h-6 w-6 ${overall.color} ${overallStatus === "checking" ? "animate-spin" : ""}`} />
              <div className="flex-1">
                <p className={`text-sm font-semibold ${overall.color}`}>{overall.label}</p>
                {lastCheck && (
                  <p className="text-[11px] text-muted-foreground">
                    Last checked: {lastCheck.toLocaleTimeString()}
                  </p>
                )}
              </div>
              <button
                onClick={runChecks}
                disabled={checking}
                className="h-9 w-9 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Services</p>
            {services.map((svc) => {
              const Icon = svc.icon;
              const sColor = svc.status === "online" ? "text-white/70" : svc.status === "degraded" ? "text-white/50" : svc.status === "offline" ? "text-white/40" : "text-muted-foreground";
              return (
                <div key={svc.name} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                  <div className="h-9 w-9 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{svc.name}</p>
                    {svc.details && <p className="text-[11px] text-muted-foreground truncate">{svc.details}</p>}
                    {svc.error && <p className="text-[11px] text-white/40 truncate">{svc.error}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <div className={`h-2 w-2 rounded-full ${svc.status === "online" ? "bg-white/50" : svc.status === "degraded" ? "bg-white/30" : svc.status === "offline" ? "bg-white/20" : "bg-muted-foreground animate-pulse"}`} />
                      <span className={`text-[11px] font-medium ${sColor}`}>
                        {svc.status === "checking" ? "..." : svc.status.charAt(0).toUpperCase() + svc.status.slice(1)}
                      </span>
                    </div>
                    {svc.latency !== undefined && (
                      <span className="text-[10px] text-muted-foreground">{svc.latency}ms</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {isAdmin && (webhookInfo || webhookError) && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Webhook Status</p>
                {webhookError && !webhookInfo && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-white/40 shrink-0" />
                    <p className="text-xs text-white/40">Failed to load: {webhookError}</p>
                  </div>
                )}
                {webhookInfo && (
                  <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">URL</span>
                      <span className="text-[11px] font-mono truncate max-w-[200px]">{webhookInfo.url || "Not set"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Pending Updates</span>
                      <Badge variant={webhookInfo.pending ? "destructive" : "outline"} className="text-[10px]">
                        {webhookInfo.pending ?? 0}
                      </Badge>
                    </div>
                    {webhookInfo.lastError && (
                      <div className="flex items-start gap-2 mt-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-white/40 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-white/40 leading-relaxed">{webhookInfo.lastError}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {isAdmin && (dbStats || dbStatsError) && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Database Stats</p>
                {dbStatsError && !dbStats && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-white/40 shrink-0" />
                    <p className="text-xs text-white/40">Failed to load: {dbStatsError}</p>
                  </div>
                )}
                {dbStats && (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Users", value: dbStats.users, icon: "👤" },
                      { label: "Messages", value: dbStats.messages, icon: "💬" },
                      { label: "Donations", value: dbStats.donations, icon: "💰" },
                      { label: "Groups", value: dbStats.groups, icon: "👥" },
                      { label: "Premium", value: dbStats.premium, icon: "⭐" },
                    ].map((stat) => (
                      <div key={stat.label} className="p-3 rounded-xl bg-muted/30 border border-border text-center">
                        <p className="text-lg">{stat.icon}</p>
                        <p className="text-base font-bold">{stat.value ?? "—"}</p>
                        <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Infrastructure</p>
            <div className="space-y-1.5">
              {[
                { label: "API Server", value: "Cloudflare Workers", icon: Server },
                { label: "Database", value: "Cloudflare D1 (SQLite)", icon: Database },
                { label: "File Storage", value: "Cloudflare R2", icon: HardDrive },
                { label: "Mini App", value: "Cloudflare Pages", icon: Globe },
                { label: "MTProto", value: "Koyeb (Node.js)", icon: Wifi },
                { label: "Bot API", value: "Telegram Bot API 9.5", icon: Bot },
                { label: "Payments", value: "OxaPay + Telegram Stars", icon: Shield },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 px-3 py-2 rounded-lg">
                  <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground flex-1">{item.label}</span>
                  <span className="text-xs font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
