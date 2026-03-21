import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RefreshCw, ShieldBan, CheckCircle2, Clock, MessageCircle, AlertTriangle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";
import { toast } from "sonner";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/miniapp", "") + "/api";

type Log = {
  id: number; user_id: string; admin_id: string; action: string;
  scope: string; reason: string | null; created_at: string;
  first_name?: string; username?: string;
};

type ModRecord = {
  user_id: string; status: string; bot_banned: number; app_banned: number;
  global_banned: number; warnings_count: number; ban_reason: string | null;
  ban_until: string | null; first_name?: string; username?: string;
};

const ACTION_BADGE: Record<string, string> = {
  ban:      "border-red-500/30 bg-red-500/10 text-red-600",
  warn:     "border-yellow-500/30 bg-yellow-500/10 text-yellow-600",
  restrict: "border-orange-500/30 bg-orange-500/10 text-orange-600",
  unban:    "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
};

const avatarColors = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-orange-500", "bg-pink-500"];
function avatarColor(name?: string) {
  return avatarColors[(name?.charCodeAt(0) ?? 0) % avatarColors.length];
}
function getInitials(name?: string) {
  return name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";
}

export function AdminModeration() {
  const reqOpts = useApiAuth();
  const headers = reqOpts.headers as Record<string, string>;
  const [logs, setLogs] = useState<Log[]>([]);
  const [records, setRecords] = useState<ModRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/moderation/logs`, { headers }).then(r => r.json()),
      fetch(`${API_BASE}/moderation/all`, { headers }).then(r => r.json()),
    ]).then(([logsData, recordsData]) => {
      if (Array.isArray(logsData)) setLogs(logsData);
      if (Array.isArray(recordsData)) setRecords(recordsData);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleUnban = async (telegramId: string) => {
    const toastId = toast.loading("Unbanning user…");
    try {
      const res = await fetch(`${API_BASE}/moderation/action`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: telegramId, action: "unban", scope: "global", reason: "" }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("User unbanned successfully", { id: toastId });
      } else {
        toast.error(data.error ?? "Failed to unban user", { id: toastId });
      }
    } catch {
      toast.error("Network error", { id: toastId });
    }
    load();
  };

  return (
    <Layout title="Moderation">
      <div className="h-full flex flex-col overflow-hidden">
        <Tabs defaultValue="active" className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background">
            <TabsList className="h-8">
              <TabsTrigger value="active" className="text-xs h-7">Active</TabsTrigger>
              <TabsTrigger value="logs" className="text-xs h-7">Logs</TabsTrigger>
            </TabsList>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          <TabsContent value="active" className="flex-1 overflow-y-auto p-4 space-y-3 mt-0">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}><CardContent className="p-4 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-8 w-full rounded-lg" />
                  </CardContent></Card>
                ))}
              </div>
            ) : !records.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <ShieldBan className="h-10 w-10 opacity-20" />
                <p className="text-sm">No active restrictions</p>
              </div>
            ) : records.map(r => (
              <Card key={r.user_id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar className={`shrink-0 ${avatarColor(r.first_name)}`}>
                      <AvatarFallback className={`text-white font-semibold text-sm ${avatarColor(r.first_name)}`}>
                        {getInitials(r.first_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{r.first_name ?? r.user_id}</p>
                      {r.username && <p className="text-xs text-muted-foreground">@{r.username}</p>}
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      {r.global_banned ? <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-600 text-[10px]">GLOBAL BAN</Badge> : null}
                      {r.bot_banned && !r.global_banned ? <Badge variant="outline" className="border-orange-500/30 bg-orange-500/10 text-orange-600 text-[10px]">BOT BAN</Badge> : null}
                      {r.app_banned && !r.global_banned ? <Badge variant="outline" className="border-yellow-500/30 bg-yellow-500/10 text-yellow-600 text-[10px]">APP BAN</Badge> : null}
                      {r.status === "restricted" ? <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-600 text-[10px]">RESTRICTED</Badge> : null}
                    </div>
                  </div>
                  {r.ban_reason && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">Reason: {r.ban_reason}</p>
                  )}
                  {r.warnings_count > 0 && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                      <p className="text-xs text-yellow-600">{r.warnings_count} warning{r.warnings_count !== 1 ? "s" : ""}</p>
                    </div>
                  )}
                  {r.ban_until && (
                    <div className="flex items-center gap-1.5 mb-3">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        Expires {formatDistanceToNow(new Date(r.ban_until), { addSuffix: true })}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-xs"
                      onClick={() => navigate(`/admin/chat/${r.user_id}`)}>
                      <MessageCircle className="h-3.5 w-3.5" /> Chat
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                      onClick={() => handleUnban(r.user_id)}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Unban
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="logs" className="flex-1 overflow-y-auto mt-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-1">
                    <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !logs.length ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                No actions logged yet.
              </div>
            ) : (
              <div>
                {logs.map((l, i) => (
                  <div key={l.id}>
                    <div className="flex items-start gap-3 px-4 py-3">
                      <Badge variant="outline" className={`${ACTION_BADGE[l.action] ?? ""} uppercase text-[10px] shrink-0 mt-0.5`}>
                        {l.action}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {l.first_name ?? l.user_id}
                          {l.username && <span className="text-muted-foreground font-normal ml-1">@{l.username}</span>}
                        </p>
                        {l.reason && <p className="text-xs text-muted-foreground truncate">Reason: {l.reason}</p>}
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {format(new Date(l.created_at), "MMM d · HH:mm")} · {l.scope ?? "—"}
                        </p>
                      </div>
                    </div>
                    {i < logs.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
