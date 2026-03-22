import { useState, useEffect } from "react";
import { useApiAuth } from "@/lib/telegram-context";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, Check, X, Clock, ChevronDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { API_BASE } from "@/lib/api";

type DeleteRequest = {
  id: number;
  telegram_id: string;
  first_name?: string;
  username?: string;
  reason: string;
  status: "pending" | "approved" | "declined";
  admin_note?: string;
  created_at: string;
  resolved_at?: string;
};

function statusBadge(status: string) {
  if (status === "pending")  return <Badge variant="outline" className="text-amber-500 border-amber-500/40 text-[10px]">Pending</Badge>;
  if (status === "approved") return <Badge variant="outline" className="text-emerald-500 border-emerald-500/40 text-[10px]">Approved</Badge>;
  return <Badge variant="outline" className="text-red-500 border-red-500/40 text-[10px]">Declined</Badge>;
}

export function AdminDeletionRequests() {
  const reqOpts = useApiAuth();
  const headers = reqOpts.headers as Record<string, string>;
  const [tab, setTab]               = useState<"pending" | "approved" | "declined">("pending");
  const [requests, setRequests]     = useState<DeleteRequest[]>([]);
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState<number | null>(null);
  const [note, setNote]             = useState("");
  const [acting, setActing]         = useState<number | null>(null);

  const load = async (status: string) => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/admin/deletion-requests?status=${status}`, { headers });
      setRequests(await r.json());
    } catch { toast.error("Failed to load requests"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(tab); }, [tab]);

  const resolve = async (id: number, action: "approve" | "decline") => {
    setActing(id);
    try {
      const r = await fetch(`${API_BASE}/admin/deletion-requests/${id}/${action}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      const j = await r.json();
      if (j.ok) {
        toast.success(action === "approve" ? "Data deleted & user notified" : "Request declined & user notified");
        setExpanded(null);
        setNote("");
        load(tab);
      } else {
        toast.error(j.error ?? "Failed");
      }
    } catch { toast.error("Network error"); }
    finally { setActing(null); }
  };

  const tabs: ("pending" | "approved" | "declined")[] = ["pending", "approved", "declined"];

  return (
    <Layout title="Deletion Requests">
      {/* Tabs */}
      <div className="flex gap-0 border-b border-border bg-background shrink-0">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
              tab === t
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="h-full overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
            <Trash2 className="h-8 w-8 opacity-20" />
            <p className="text-sm">No {tab} requests</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {requests.map(req => (
              <div key={req.id} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Header row */}
                <button
                  className="w-full flex items-start gap-3 p-3 text-left"
                  onClick={() => setExpanded(expanded === req.id ? null : req.id)}
                >
                  <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold truncate">
                        {req.first_name ?? "User"}{req.username ? ` @${req.username}` : ""}
                      </span>
                      {statusBadge(req.status)}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{req.reason}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">· ID: {req.telegram_id}</span>
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform ${expanded === req.id ? "rotate-180" : ""}`} />
                </button>

                {/* Expanded */}
                {expanded === req.id && (
                  <>
                    <Separator />
                    <div className="p-3 space-y-3">
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Reason</p>
                        <p className="text-sm text-foreground leading-relaxed">{req.reason}</p>
                      </div>

                      {req.admin_note && (
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Admin Note</p>
                          <p className="text-sm text-muted-foreground">{req.admin_note}</p>
                        </div>
                      )}

                      {req.status === "pending" && (
                        <>
                          <Textarea
                            placeholder="Optional note to send to user…"
                            className="text-xs min-h-[60px] resize-none"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={acting === req.id}
                              onClick={() => resolve(req.id, "approve")}
                            >
                              <Check className="h-3.5 w-3.5 mr-1" />
                              Approve &amp; Delete Data
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-8 text-xs border-red-500/40 text-red-500 hover:bg-red-500/10"
                              disabled={acting === req.id}
                              onClick={() => resolve(req.id, "decline")}
                            >
                              <X className="h-3.5 w-3.5 mr-1" />
                              Decline
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
