import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { Loader2, Users, MessageCircle, RefreshCw, Search } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/miniapp", "") + "/api";

type User = {
  id: number; telegram_id: string; first_name: string; username?: string;
  last_msg?: string; last_msg_at?: string; last_media_type?: string;
};

function preview(u: User) {
  if (!u.last_msg && !u.last_media_type) return "No messages yet";
  if (u.last_media_type && u.last_media_type !== "text") return `[${u.last_media_type}]`;
  return u.last_msg ? (u.last_msg.length > 40 ? u.last_msg.slice(0, 40) + "…" : u.last_msg) : "";
}

function Avatar({ name }: { name: string }) {
  const initials = name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  const colors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-pink-500", "bg-cyan-500"];
  const color = colors[name?.charCodeAt(0) % colors.length] ?? "bg-primary";
  return (
    <div className={`w-11 h-11 rounded-full ${color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
      {initials}
    </div>
  );
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
    return u.first_name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.telegram_id.includes(q);
  });

  return (
    <Layout title="Users">
      <div className="h-full flex flex-col overflow-hidden">

        {/* Search + Stats bar */}
        <div className="p-4 border-b border-border/50 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search users..."
                className="w-full pl-9 pr-4 py-2 bg-background border border-border/50 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors" />
            </div>
            <button onClick={load} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{users.length} registered users</span>
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-muted-foreground" /></div>
          ) : !filtered.length ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {query ? "No users match your search." : "No users yet."}
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filtered.map(u => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/2 transition-colors">
                  <Avatar name={u.first_name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="font-semibold text-sm truncate">{u.first_name}</p>
                      {u.username && <p className="text-xs text-muted-foreground shrink-0">@{u.username}</p>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{preview(u)}</p>
                    {u.last_msg_at && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {format(new Date(u.last_msg_at), 'MMM d · HH:mm')}
                      </p>
                    )}
                  </div>
                  <button onClick={() => navigate(`/admin/chat/${u.id}`)}
                    className="p-2 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors shrink-0">
                    <MessageCircle className="w-4 h-4 text-primary" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
