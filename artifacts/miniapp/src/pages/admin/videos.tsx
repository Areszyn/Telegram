import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { toast } from "sonner";
import { Film, Trash2, ExternalLink, Download, RefreshCw, Clock, User, FileVideo, Copy, Check } from "lucide-react";

import { API_BASE } from "@/lib/api";

function useAdminFetch() {
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  return useCallback(
    async (path: string, method = "GET") => {
      const res = await fetch(`${API_BASE}${path}`, { method, headers });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      return data;
    },
    [headers],
  );
}

interface VideoEntry {
  uid:         string;
  fileName:    string;
  fromName:    string;
  fromId:      string;
  fileSize:    number;
  exp:         number;
  addedAt:     number;
  watchUrl:    string;
  downloadUrl: string;
}

function CopyBtn({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy not supported");
    }
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
    >
      {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
      {copied ? "Copied!" : "Copy Link"}
    </button>
  );
}

function fmtBytes(n: number) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtCountdown(exp: number) {
  const diff = exp - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function AdminVideos() {
  const af = useAdminFetch();
  const [videos, setVideos]     = useState<VideoEntry[]>([]);
  const [loading, setLoading]   = useState(false);
  const [deletingUid, setDel]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await af("/admin/videos");
      setVideos(data.videos ?? []);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Failed to load videos");
    } finally {
      setLoading(false);
    }
  }, [af]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (uid: string) => {
    if (!confirm("Revoke this video link? The watch/download URL will immediately stop working.")) return;
    setDel(uid);
    try {
      await af(`/admin/videos/${uid}`, "DELETE");
      setVideos(v => v.filter(x => x.uid !== uid));
      toast.success("Link revoked");
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Failed to revoke");
    } finally {
      setDel(null);
    }
  };

  return (
    <Layout title="Video Links">
      <div className="flex flex-col h-full">
        {/* toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
          <span className="text-sm text-muted-foreground">
            {videos.length} active link{videos.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm text-primary hover:opacity-80 disabled:opacity-40"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto divide-y">
          {loading && videos.length === 0 && (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Loading…
            </div>
          )}

          {!loading && videos.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <Film size={32} className="opacity-30" />
              <span className="text-sm">No active video links</span>
              <span className="text-xs opacity-70">Links appear here when anyone sends a video to the bot</span>
            </div>
          )}

          {videos.map(v => (
            <div key={v.uid} className="px-4 py-3 flex flex-col gap-2">
              {/* top row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileVideo size={16} className="text-primary shrink-0" />
                  <span className="font-medium text-sm truncate">{v.fileName}</span>
                </div>
                <button
                  onClick={() => handleDelete(v.uid)}
                  disabled={deletingUid === v.uid}
                  className="flex items-center gap-1 text-xs text-destructive hover:opacity-70 disabled:opacity-40 shrink-0"
                >
                  <Trash2 size={13} />
                  {deletingUid === v.uid ? "Revoking…" : "Revoke"}
                </button>
              </div>

              {/* meta row */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User size={11} />
                  {v.fromName} <span className="opacity-60">({v.fromId})</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {fmtCountdown(v.exp)}
                </span>
                {v.fileSize > 0 && (
                  <span>{fmtBytes(v.fileSize)}</span>
                )}
                <span className="opacity-60">{fmtTime(v.addedAt)}</span>
              </div>

              {/* action buttons */}
              <div className="flex flex-wrap gap-2">
                <a
                  href={v.watchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <ExternalLink size={11} />
                  Web Player
                </a>
                <CopyBtn url={v.watchUrl} />
                <a
                  href={v.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  <Download size={11} />
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
