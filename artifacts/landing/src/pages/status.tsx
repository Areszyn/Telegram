import { useState, useEffect, useCallback } from "react";
import { useTheme } from "@/App";

const API_BASE = "https://mini.susagar.sbs/api";

type ServiceStatus = {
  name: string;
  status: "checking" | "online" | "offline" | "degraded";
  latency?: number;
  details?: string;
  error?: string;
};

const serviceChecks = [
  { name: "Cloudflare Worker (API)", url: `${API_BASE}/health` },
  { name: "D1 Database", url: `${API_BASE}/health/db` },
  { name: "Telegram Bot API", url: `${API_BASE}/health/bot` },
  { name: "MTProto Backend (Koyeb)", url: `${API_BASE}/health/mtproto` },
  { name: "Cloudflare Pages", url: "https://lifegram-miniapp.pages.dev/miniapp/" },
];

const infra = [
  { label: "API Server", value: "Cloudflare Workers" },
  { label: "Database", value: "Cloudflare D1 (SQLite)" },
  { label: "File Storage", value: "Cloudflare R2" },
  { label: "Mini App", value: "Cloudflare Pages" },
  { label: "MTProto", value: "Koyeb (Node.js)" },
  { label: "Bot API", value: "Telegram Bot API 9.5" },
  { label: "Payments", value: "OxaPay + Telegram Stars" },
];

export function StatusPage() {
  const { lang } = useTheme();
  const L = (en: string, ne: string) => lang === "ne" ? ne : en;
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);

  const checkService = async (name: string, url: string): Promise<ServiceStatus> => {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      const latency = Date.now() - start;
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { name, status: "online", latency, details: data.bot || data.db || data.runtime || data.status || "OK" };
      }
      return { name, status: "degraded", latency, error: `HTTP ${res.status}` };
    } catch (e) {
      return { name, status: "offline", latency: Date.now() - start, error: e instanceof Error ? e.message : "Unknown error" };
    }
  };

  const runChecks = useCallback(async () => {
    setChecking(true);
    const results = await Promise.all(
      serviceChecks.map((s) => checkService(s.name, s.url))
    );
    setServices(results);
    setLastCheck(new Date());
    setChecking(false);
  }, []);

  useEffect(() => { runChecks(); }, []);

  const overallStatus = services.length === 0
    ? "checking"
    : services.every((s) => s.status === "online")
      ? "online"
      : services.some((s) => s.status === "offline")
        ? "offline"
        : "degraded";

  const overallLabel: Record<string, string> = {
    checking: L("Checking...", "जाँच गर्दै..."),
    online: L("All Systems Operational", "सबै प्रणाली सञ्चालनमा"),
    degraded: L("Partial Outage", "आंशिक आउटेज"),
    offline: L("Major Outage", "प्रमुख आउटेज"),
  };

  const dotColor: Record<string, string> = {
    checking: "bg-muted-foreground animate-pulse",
    online: "bg-green-500",
    degraded: "bg-yellow-500",
    offline: "bg-red-500",
  };

  return (
    <section className="pt-32 pb-20 min-h-screen">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 text-xs font-medium border border-border rounded-full text-muted-foreground mb-4">
            {L("Status", "स्थिति")}
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">{L("System Status", "प्रणाली स्थिति")}</h1>
          <p className="text-muted-foreground text-sm">
            {L("Live health checks for all Lifegram services", "सबै Lifegram सेवाहरूको लाइभ स्वास्थ्य जाँच")}
          </p>
        </div>

        <div className="border border-border rounded-xl p-5 mb-6 bg-card/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${dotColor[overallStatus]}`} />
              <div>
                <p className="text-sm font-semibold">{overallLabel[overallStatus]}</p>
                {lastCheck && (
                  <p className="text-xs text-muted-foreground">
                    Last checked: {lastCheck.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={runChecks}
              disabled={checking}
              className="px-4 py-2 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <svg className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
              {L("Refresh", "रिफ्रेस")}
            </button>
          </div>
        </div>

        <div className="space-y-2 mb-10">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-3">{L("Services", "सेवाहरू")}</p>
          {services.map((svc) => (
            <div key={svc.name} className="flex items-center gap-4 p-4 border border-border rounded-xl bg-card/30">
              <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${dotColor[svc.status]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{svc.name}</p>
                {svc.details && <p className="text-xs text-muted-foreground truncate">{svc.details}</p>}
                {svc.error && <p className="text-xs text-red-400 truncate">{svc.error}</p>}
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span className={`text-xs font-medium ${svc.status === "online" ? "text-green-500" : svc.status === "degraded" ? "text-yellow-500" : svc.status === "offline" ? "text-red-500" : "text-muted-foreground"}`}>
                  {svc.status === "checking" ? "..." : svc.status.charAt(0).toUpperCase() + svc.status.slice(1)}
                </span>
                {svc.latency !== undefined && (
                  <span className="text-[11px] text-muted-foreground">{svc.latency}ms</span>
                )}
              </div>
            </div>
          ))}
          {services.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {L("Running health checks...", "स्वास्थ्य जाँच चलिरहेको छ...")}
            </div>
          )}
        </div>

        <div className="border border-border rounded-xl p-5 bg-card/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">{L("Infrastructure", "पूर्वाधार")}</p>
          <div className="space-y-2.5">
            {infra.map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-sm font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center">
          <a
            href={`${API_BASE}/init-db`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors"
          >
            {L("View API Dashboard", "API ड्यासबोर्ड हेर्नुहोस्")} &rarr;
          </a>
        </div>
      </div>
    </section>
  );
}
