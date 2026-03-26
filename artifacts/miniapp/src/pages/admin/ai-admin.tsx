import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { API_BASE } from "@/lib/api";
import { Bot, Trash2, MessageSquare, Users, BarChart3, ChevronRight } from "lucide-react";

interface AdminStats {
  total_conversations: number;
  total_messages: number;
  unique_users: number;
}

interface ModelBreakdown {
  model: string;
  count: number;
}

interface AdminConversation {
  id: number;
  owner_telegram_id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

const PROVIDER_ICONS: Record<string, string> = {
  openai: "🤖",
  anthropic: "🧠",
  gemini: "✨",
};

function getProvider(model: string): string {
  if (model.startsWith("gpt")) return "openai";
  if (model.startsWith("gemini")) return "gemini";
  return "anthropic";
}

export function AiAdmin() {
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [modelBreakdown, setModelBreakdown] = useState<ModelBreakdown[]>([]);
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/ai/admin/stats`, { headers }).then(r => r.json()).then(d => {
      if (d.stats) setStats(d.stats);
      if (d.modelBreakdown) setModelBreakdown(d.modelBreakdown);
    }).catch(() => {});
    loadConversations();
  }, []);

  const loadConversations = async (p = 1) => {
    try {
      const r = await fetch(`${API_BASE}/ai/admin/conversations?page=${p}`, { headers });
      const d = await r.json();
      if (d.conversations) setConversations(d.conversations);
      if (d.total !== undefined) setTotal(d.total);
      setPage(p);
    } catch {}
  };

  const deleteConv = async (id: number) => {
    try {
      await fetch(`${API_BASE}/ai/admin/conversations/${id}`, { method: "DELETE", headers });
      setConversations(prev => prev.filter(c => c.id !== id));
      setTotal(prev => prev - 1);
    } catch {}
  };

  return (
    <Layout title="AI Admin">
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Conversations", value: stats?.total_conversations ?? 0, icon: MessageSquare, color: "text-white/60" },
            { label: "Messages", value: stats?.total_messages ?? 0, icon: BarChart3, color: "text-white/60" },
            { label: "Users", value: stats?.unique_users ?? 0, icon: Users, color: "text-white/60" },
          ].map((s, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <s.icon size={18} className={`mx-auto mb-1 ${s.color}`} />
              <p className="text-lg font-bold text-white/90">{s.value}</p>
              <p className="text-[10px] text-white/40">{s.label}</p>
            </div>
          ))}
        </div>

        {modelBreakdown.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <h3 className="text-xs font-medium text-white/50 mb-2">Model Usage</h3>
            <div className="space-y-2">
              {modelBreakdown.map((m, i) => {
                const maxCount = modelBreakdown[0]?.count || 1;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm">{PROVIDER_ICONS[getProvider(m.model)]}</span>
                    <span className="text-xs text-white/70 w-32 truncate">{m.model}</span>
                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-white/30 rounded-full transition-all"
                        style={{ width: `${(m.count / maxCount) * 100}%` }} />
                    </div>
                    <span className="text-xs text-white/40 w-10 text-right">{m.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-xs font-medium text-white/50">All Conversations ({total})</h3>
          </div>
          <div className="divide-y divide-white/5">
            {conversations.map(conv => (
              <div key={conv.id} className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors">
                <span className="text-sm">{PROVIDER_ICONS[getProvider(conv.model)]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/80 truncate">{conv.title}</p>
                  <p className="text-[10px] text-white/30">
                    User {conv.owner_telegram_id} · {conv.model} · {new Date(conv.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => deleteConv(conv.id)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <Trash2 size={14} className="text-white/40" />
                </button>
              </div>
            ))}
            {conversations.length === 0 && (
              <p className="text-xs text-white/30 text-center py-8">No AI conversations yet</p>
            )}
          </div>
          {total > 20 && (
            <div className="p-2 border-t border-white/10 flex justify-center gap-2">
              <button disabled={page <= 1} onClick={() => loadConversations(page - 1)}
                className="px-3 py-1 text-xs rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30">
                Prev
              </button>
              <span className="text-xs text-white/40 py-1">{page} / {Math.ceil(total / 20)}</span>
              <button disabled={page * 20 >= total} onClick={() => loadConversations(page + 1)}
                className="px-3 py-1 text-xs rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30">
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
