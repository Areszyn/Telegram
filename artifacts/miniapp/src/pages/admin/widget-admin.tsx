import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Trash2, Pause, Play, Globe, MessageSquare, Users, BarChart3, Shield, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

type AdminWidget = {
  id: number;
  widget_key: string;
  owner_telegram_id: string;
  site_name: string;
  color: string;
  greeting: string;
  position: string;
  active: number;
  allowed_domains: string;
  created_at: string;
  session_count: number;
  unread_count: number;
  owner_name: string;
  owner_username: string;
};

type Stats = {
  total_widgets: number;
  active_widgets: number;
  total_sessions: number;
  total_messages: number;
  unique_owners: number;
};

export function AdminWidgetManager() {
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  const [widgets, setWidgets] = useState<AdminWidget[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/widget/admin/all-widgets`, { headers }).then(r => r.json()),
      fetch(`${API_BASE}/widget/admin/stats`, { headers }).then(r => r.json()),
    ]).then(([w, s]) => {
      if (Array.isArray(w)) setWidgets(w);
      if (s && !s.error) setStats(s);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleWidget = async (key: string) => {
    try {
      const res = await fetch(`${API_BASE}/widget/admin/${key}/toggle`, {
        method: "PUT", headers,
      });
      const d = await res.json();
      if (d.ok) {
        setWidgets(prev => prev.map(w => w.widget_key === key ? { ...w, active: d.active } : w));
        toast.success(d.active ? "Widget activated" : "Widget paused");
      }
    } catch { toast.error("Failed"); }
  };

  const deleteWidget = async (key: string, name: string) => {
    if (!confirm(`Delete widget "${name || key}"? This removes all conversations and messages.`)) return;
    try {
      const res = await fetch(`${API_BASE}/widget/admin/${key}`, {
        method: "DELETE", headers,
      });
      const d = await res.json();
      if (d.ok) {
        setWidgets(prev => prev.filter(w => w.widget_key !== key));
        toast.success("Widget deleted");
      }
    } catch { toast.error("Failed"); }
  };

  const filtered = widgets.filter(w => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (w.site_name?.toLowerCase().includes(s) ||
      w.widget_key.toLowerCase().includes(s) ||
      w.owner_name?.toLowerCase().includes(s) ||
      w.owner_username?.toLowerCase().includes(s) ||
      w.owner_telegram_id.includes(s) ||
      w.allowed_domains?.toLowerCase().includes(s));
  });

  return (
    <Layout title="Widget Admin">
      <div className="h-full overflow-y-auto p-4 space-y-4">
        {stats && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Widgets", value: stats.total_widgets, sub: `${stats.active_widgets} active`, icon: Globe },
              { label: "Sessions", value: stats.total_sessions, icon: Users },
              { label: "Messages", value: stats.total_messages, sub: `${stats.unique_owners} owners`, icon: BarChart3 },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
                <s.icon className="h-4 w-4 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
                {s.sub && <p className="text-[9px] text-muted-foreground">{s.sub}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-xs">All User Widgets</h2>
            <Badge variant="secondary" className="text-[10px] ml-auto">{filtered.length}</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, key, owner, domain..."
              className="pl-9 text-xs h-8"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No widgets found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(w => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl p-3"
              >
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: w.color }}>
                    <MessageSquare className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold truncate">{w.site_name || "Unnamed"}</p>
                      <Badge variant={w.active ? "default" : "destructive"} className="text-[9px] px-1.5 py-0">
                        {w.active ? "Live" : "Paused"}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{w.widget_key}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-muted-foreground mb-2 ml-10">
                  <span>Owner: <span className="text-foreground font-medium">{w.owner_name || "Unknown"} {w.owner_username ? `@${w.owner_username}` : ""}</span></span>
                  <span>ID: <span className="text-foreground font-mono">{w.owner_telegram_id}</span></span>
                  <span>Domains: <span className="text-foreground">{w.allowed_domains || "Any"}</span></span>
                  <span>Sessions: <span className="text-foreground font-medium">{w.session_count}</span>{w.unread_count > 0 ? <span className="text-orange-400 ml-1">({w.unread_count} unread)</span> : ""}</span>
                  <span>Created: <span className="text-foreground">{new Date(w.created_at + "Z").toLocaleDateString()}</span></span>
                </div>

                <div className="flex gap-1.5 ml-10">
                  <Button
                    size="sm"
                    variant={w.active ? "outline" : "default"}
                    className="text-[10px] h-7 gap-1 flex-1"
                    onClick={() => toggleWidget(w.widget_key)}
                  >
                    {w.active ? <><Pause className="h-3 w-3" /> Pause</> : <><Play className="h-3 w-3" /> Activate</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-[10px] h-7 text-destructive"
                    onClick={() => deleteWidget(w.widget_key, w.site_name)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
