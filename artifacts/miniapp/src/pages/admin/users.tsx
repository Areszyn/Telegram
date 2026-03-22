import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, RefreshCw, Search, Users } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";

import { API_BASE } from "@/lib/api";

type User = {
  id: number; telegram_id: string; first_name: string; username?: string;
  last_msg?: string; last_msg_at?: string; last_media_type?: string;
};

function preview(u: User) {
  if (!u.last_msg && !u.last_media_type) return "No messages yet";
  if (u.last_media_type && u.last_media_type !== "text") return `[${u.last_media_type}]`;
  return u.last_msg ? (u.last_msg.length > 44 ? u.last_msg.slice(0, 44) + "…" : u.last_msg) : "";
}

function getInitials(name?: string) {
  return name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";
}

const avatarColors = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-orange-500", "bg-pink-500", "bg-cyan-500"];
function avatarColor(name?: string) {
  return avatarColors[(name?.charCodeAt(0) ?? 0) % avatarColors.length];
}

export function AdminUsers() {
  const reqOpts = useApiAuth();
  const headers = reqOpts.headers as Record<string, string>;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();

  const load = () => {
    setLoading(true);
    fetch(`${API_BASE}/users`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setUsers(d))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter(u => {
    if (!query) return true;
    const q = query.toLowerCase();
    return u.first_name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) || u.telegram_id.includes(q);
  });

  return (
    <Layout title="Users">
      <div className="h-full flex flex-col overflow-hidden">
        <div className="p-3 space-y-2 border-b border-border bg-background">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name, username or ID…"
                className="pl-8 text-sm"
              />
            </div>
            <Button variant="outline" size="icon" onClick={load} className="shrink-0">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-0.5">
            <Users className="h-3.5 w-3.5" />
            <span>{users.length} registered users</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                </div>
              ))}
            </div>
          ) : !filtered.length ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              {query ? "No users match your search." : "No users yet."}
            </div>
          ) : (
            <div>
              {filtered.map((u, i) => (
                <div key={u.id}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                    <Avatar className={`shrink-0 ${avatarColor(u.first_name)}`}>
                      <AvatarFallback className={`text-white font-semibold text-sm ${avatarColor(u.first_name)}`}>
                        {getInitials(u.first_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-semibold text-sm truncate">{u.first_name}</span>
                        {u.username && <span className="text-xs text-muted-foreground shrink-0">@{u.username}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{preview(u)}</p>
                      {u.last_msg_at && (
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {format(new Date(u.last_msg_at), "MMM d · HH:mm")}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8"
                      onClick={() => navigate(`/admin/chat/${u.id}`)}
                    >
                      <MessageCircle className="h-4 w-4 text-primary" />
                    </Button>
                  </div>
                  {i < filtered.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
