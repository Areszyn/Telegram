import { useState, useEffect } from "react";
import { useTelegram, useApiAuth } from "@/lib/telegram-context";
import { API_BASE } from "@/lib/api";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useCookieConsent } from "@/components/CookieBanner";
import {
  User, Shield, Trash2, Cookie, ExternalLink,
  CheckCircle, Clock, XCircle, Home, Bell, Share2,
  MapPin, ScanLine, Clipboard, Smartphone, AlertTriangle,
  ShieldAlert, ShieldCheck, Ban, Loader2,
  Pencil, KeyRound, ChevronRight,
} from "lucide-react";
import { useLocation } from "wouter";
import { NotionAvatar } from "@/components/notion-avatar";
import { AvatarPicker } from "@/components/avatar-picker";

type DeleteRequest = {
  id: number;
  status: "pending" | "approved" | "declined";
  admin_note?: string;
  created_at: string;
} | null;

type ModerationStatus = {
  allowed: boolean;
  restricted: boolean;
  reason: string | null;
  ban_until: string | null;
  warnings_count: number;
  status: string;
} | null;

export function UserAccount() {
  const { profile, addToHomeScreen, requestWriteAccess, shareText, isInsideTelegram, showQrScanner, readClipboard, haptic, platform, version, openLink, showAlert } = useTelegram();
  const reqOpts           = useApiAuth();
  const headers           = reqOpts.headers as Record<string, string>;
  const { consent, update } = useCookieConsent();
  const [, navigate] = useLocation();
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);

  const [reason, setReason]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [delRequest, setDelRequest] = useState<DeleteRequest>(undefined as unknown as DeleteRequest);
  const [loadingReq, setLoadingReq] = useState(true);
  const [modStatus, setModStatus]   = useState<ModerationStatus>(null);
  const [loadingMod, setLoadingMod] = useState(true);
  const [avatarId, setAvatarId]     = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const telegramId = profile?.telegram_id;

  useEffect(() => {
    if (!telegramId) return;
    fetch(`${API_BASE}/user/deletion-request`, { headers })
      .then(r => r.json())
      .then(d => setDelRequest(d))
      .catch(() => setDelRequest(null))
      .finally(() => setLoadingReq(false));
    fetch(`${API_BASE}/moderation/my-status`, { headers })
      .then(r => r.json())
      .then(d => { if (!d.error) setModStatus(d); })
      .catch(() => {})
      .finally(() => setLoadingMod(false));
    fetch(`${API_BASE}/my-profile`, { headers })
      .then(r => r.json())
      .then(d => { if (d.avatar) setAvatarId(Number(d.avatar)); })
      .catch(() => {});
  }, [telegramId]);

  const saveAvatar = async (id: number) => {
    setSavingAvatar(true);
    try {
      const r = await fetch(`${API_BASE}/user/avatar`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_id: id }),
      });
      const d = await r.json();
      if (d.ok) {
        setAvatarId(id);
        setShowPicker(false);
        toast.success("Avatar updated!");
        haptic?.("medium");
      } else {
        toast.error(d.error ?? "Failed to save avatar");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSavingAvatar(false);
    }
  };

  const submitRequest = async () => {
    if (reason.trim().length < 10) {
      toast.error("Please provide a reason (at least 10 characters).");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`${API_BASE}/user/deletion-request`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const j = await r.json();
      if (j.ok) {
        toast.success("Request submitted. Admin will review it shortly.");
        setReason("");
        setDelRequest({ id: 0, status: "pending", created_at: new Date().toISOString() });
      } else {
        toast.error(j.error ?? "Failed to submit request.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const requestStatusIcon = (status?: string) => {
    if (status === "approved")  return <CheckCircle className="h-4 w-4 text-white/60" />;
    if (status === "declined")  return <XCircle className="h-4 w-4 text-white/40" />;
    return <Clock className="h-4 w-4 text-white/40" />;
  };

  return (
    <Layout title="My Account">
      <div className="h-full overflow-y-auto p-4 space-y-4">

        {showPicker && (
          <AvatarPicker
            current={avatarId}
            onSelect={saveAvatar}
            onClose={() => setShowPicker(false)}
            loading={savingAvatar}
          />
        )}

        {/* Profile card */}
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <button
            onClick={() => setShowPicker(true)}
            className="relative shrink-0 group"
          >
            <NotionAvatar avatarId={avatarId} size={48} fallback={profile?.first_name ?? undefined} />
            <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex items-center justify-center">
              <Pencil className="h-3.5 w-3.5 text-white" />
            </div>
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">
              {profile?.first_name ?? "User"}
              {profile?.username ? <span className="text-muted-foreground font-normal"> @{profile.username}</span> : null}
            </p>
            <p className="text-[11px] text-muted-foreground">Telegram ID: {telegramId}</p>
            <button
              onClick={() => setShowPicker(true)}
              className="text-[10px] text-primary font-medium mt-0.5 hover:underline"
            >
              {avatarId ? "Change avatar" : "Choose an avatar"}
            </button>
          </div>
        </div>

        {/* Account Status */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <ShieldAlert className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium">Account Status</span>
            {!loadingMod && modStatus && (
              <div className="ml-auto">
                {modStatus.allowed && !modStatus.restricted ? (
                  <Badge variant="outline" className="text-white/60 border-white/20 text-[10px]">Good Standing</Badge>
                ) : modStatus.restricted ? (
                  <Badge variant="outline" className="text-white/40 border-white/15 text-[10px]">Restricted</Badge>
                ) : (
                  <Badge variant="outline" className="text-white/40 border-white/15 text-[10px]">Banned</Badge>
                )}
              </div>
            )}
          </div>
          <Separator />
          <div className="px-4 py-3">
            {loadingMod ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : !modStatus ? (
              <p className="text-xs text-muted-foreground">Unable to load status.</p>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  {modStatus.allowed && !modStatus.restricted ? (
                    <ShieldCheck className="h-5 w-5 text-white/60" />
                  ) : modStatus.restricted ? (
                    <AlertTriangle className="h-5 w-5 text-white/40" />
                  ) : (
                    <Ban className="h-5 w-5 text-white/40" />
                  )}
                  <div>
                    <p className="text-sm font-medium capitalize">{modStatus.status}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {modStatus.warnings_count > 0
                        ? `${modStatus.warnings_count} warning${modStatus.warnings_count > 1 ? "s" : ""}`
                        : "No warnings"}
                    </p>
                  </div>
                </div>
                {modStatus.reason && (
                  <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                    <p className="text-xs text-white/50 font-medium">Reason</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{modStatus.reason}</p>
                  </div>
                )}
                {modStatus.ban_until && (
                  <p className="text-[11px] text-muted-foreground">
                    Restriction until: <span className="font-medium text-foreground">{new Date(modStatus.ban_until).toLocaleDateString()}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Session Setup */}
        <button
          onClick={() => navigate("/session")}
          className="w-full bg-card border border-border rounded-2xl overflow-hidden hover:bg-muted/50 transition-colors text-left"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <KeyRound className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">MTProto Session</p>
              <p className="text-[11px] text-muted-foreground">Required for ban-all, tag-all & silent ban</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </button>

        {/* App shortcuts */}
        {isInsideTelegram && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3">
              <Home className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium">App Shortcuts</span>
            </div>
            <Separator />
            <div className="px-4 py-3 space-y-2">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Add Lifegram to your home screen for quick access, allow bot messages, or share with friends.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1"
                  onClick={() => {
                    addToHomeScreen();
                    toast.success("Follow the prompt to add to home screen");
                  }}
                >
                  <Home className="h-3.5 w-3.5" />
                  Home
                </Button>
                <Button
                  size="sm"
                  variant={notifGranted === true ? "default" : "outline"}
                  className="h-8 text-xs gap-1"
                  onClick={() => {
                    requestWriteAccess((granted) => {
                      setNotifGranted(granted);
                      if (granted) toast.success("Notifications enabled!");
                      else toast.error("Access not granted.");
                    });
                  }}
                >
                  <Bell className="h-3.5 w-3.5" />
                  Notify
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1"
                  onClick={() => {
                    shareText("https://t.me/lifegrambot — Support & Premium Tools");
                    toast.success("Sharing…");
                  }}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Tools */}
        {isInsideTelegram && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3">
              <Smartphone className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium">Quick Tools</span>
              {platform && (
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                  {platform} v{version}
                </span>
              )}
            </div>
            <Separator />
            <div className="px-4 py-3 space-y-2">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Use Telegram-native features directly from the app.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs gap-1.5 flex-col py-1"
                  onClick={() => {
                    toast.loading("Getting location...", { id: "loc" });
                    let resolved = false;

                    const onSuccess = (lat: number, lng: number) => {
                      if (resolved) return;
                      resolved = true;
                      const url = `https://maps.google.com/?q=${lat},${lng}`;
                      toast.success(`${lat.toFixed(5)}, ${lng.toFixed(5)}`, { id: "loc" });
                      haptic("medium");
                      try { openLink(url); } catch { window.open(url, "_blank"); }
                    };

                    const onFail = (msg: string) => {
                      if (resolved) return;
                      resolved = true;
                      toast.error(msg, { id: "loc" });
                    };

                    const useBrowserGeo = () => {
                      if (resolved) return;
                      if (!navigator.geolocation) { onFail("Location not supported"); return; }
                      const tid = setTimeout(() => onFail("Location timed out. Check device settings."), 15000);
                      navigator.geolocation.getCurrentPosition(
                        (pos) => { clearTimeout(tid); onSuccess(pos.coords.latitude, pos.coords.longitude); },
                        (err) => { clearTimeout(tid); onFail(err.code === 1 ? "Location denied. Enable in settings." : "Could not get location."); },
                        { timeout: 12000, enableHighAccuracy: false, maximumAge: 60000 },
                      );
                    };

                    try {
                      const tg = (window as any).Telegram?.WebApp;
                      const locMgr = tg?.LocationManager;
                      if (locMgr && typeof locMgr.init === "function") {
                        const initTid = setTimeout(() => useBrowserGeo(), 3000);
                        locMgr.init(() => {
                          clearTimeout(initTid);
                          if (resolved) return;
                          if (!locMgr.isInited || !locMgr.isLocationAvailable) { useBrowserGeo(); return; }
                          if (!locMgr.isAccessGranted) {
                            locMgr.openSettings?.();
                            onFail("Grant location access and try again");
                            return;
                          }
                          locMgr.getLocation((loc: { latitude: number; longitude: number } | null) => {
                            if (loc) onSuccess(loc.latitude, loc.longitude);
                            else useBrowserGeo();
                          });
                        });
                      } else {
                        useBrowserGeo();
                      }
                    } catch { useBrowserGeo(); }
                  }}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Location
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs gap-1.5 flex-col py-1"
                  onClick={() => {
                    showQrScanner((text) => {
                      if (text) {
                        const isUrl = /^https?:\/\//i.test(text);
                        if (isUrl) {
                          try { openLink(text); } catch { window.open(text, "_blank"); }
                        }
                        showAlert(text.length > 300 ? text.slice(0, 300) + "..." : text);
                        haptic("medium");
                      }
                    });
                  }}
                >
                  <ScanLine className="h-3.5 w-3.5" />
                  QR Scan
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs gap-1.5 flex-col py-1"
                  onClick={() => {
                    readClipboard((text) => {
                      if (text) {
                        showAlert(text.length > 300 ? text.slice(0, 300) + "..." : text);
                        haptic("light");
                      } else {
                        toast.error("Clipboard empty or access denied");
                      }
                    });
                  }}
                >
                  <Clipboard className="h-3.5 w-3.5" />
                  Clipboard
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* App Info */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <Smartphone className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium">App Info</span>
          </div>
          <Separator />
          <div className="divide-y divide-border">
            <a
              href="https://areszyn.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <ExternalLink className="h-4 w-4 text-white/50" />
                <div>
                  <p className="text-sm font-medium">Landing Page</p>
                  <p className="text-[11px] text-muted-foreground">Visit areszyn.org</p>
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
            <div className="flex items-center justify-between w-full px-4 py-3">
              <div className="flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-white/50" />
                <div>
                  <p className="text-sm font-medium">Web Version</p>
                  <p className="text-[11px] text-muted-foreground">v2.8.0</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy & Policy */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <Shield className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium">Privacy &amp; Policy</span>
          </div>
          <Separator />
          <a
            href="https://mini.susagar.sbs/api/privacy"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <div>
              <p className="text-sm font-medium">Privacy Policy &amp; Terms</p>
              <p className="text-[11px] text-muted-foreground">What we collect and your rights</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
        </div>

        {/* Cookie consent */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <Cookie className="h-4 w-4 text-white/50 shrink-0" />
            <span className="text-sm font-medium">Cookie &amp; Data Consent</span>
            <div className="ml-auto">
              {consent === "accepted" && <Badge variant="outline" className="text-white/60 border-white/20 text-[10px]">Accepted</Badge>}
              {consent === "declined" && <Badge variant="outline" className="text-muted-foreground text-[10px]">Declined</Badge>}
              {!consent && <Badge variant="outline" className="text-white/40 border-white/15 text-[10px]">Pending</Badge>}
            </div>
          </div>
          <Separator />
          <div className="px-4 py-3 space-y-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              We collect your IP address, device info, language, and timezone to operate and improve the service.
              Essential data is always collected regardless of this preference.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={consent === "accepted" ? "default" : "outline"}
                className="flex-1 h-7 text-xs"
                onClick={async () => {
                  update("accepted");
                  toast.success("Consent updated to Accepted");
                  if (telegramId) {
                    await fetch(`${API_BASE}/user/device-info`, {
                      method: "POST",
                      headers: { ...headers, "Content-Type": "application/json" },
                      body: JSON.stringify({
                        cookie_consent: "accepted",
                        platform: navigator.platform,
                        language: navigator.language,
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        screen: `${window.screen.width}x${window.screen.height}`,
                      }),
                    }).catch(() => {});
                  }
                }}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant={consent === "declined" ? "default" : "outline"}
                className="flex-1 h-7 text-xs"
                onClick={async () => {
                  update("declined");
                  toast.success("Consent updated to Declined");
                  if (telegramId) {
                    await fetch(`${API_BASE}/user/device-info`, {
                      method: "POST",
                      headers: { ...headers, "Content-Type": "application/json" },
                      body: JSON.stringify({ cookie_consent: "declined" }),
                    }).catch(() => {});
                  }
                }}
              >
                Decline
              </Button>
            </div>
          </div>
        </div>

        {/* Data deletion request */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <Trash2 className="h-4 w-4 text-white/40 shrink-0" />
            <span className="text-sm font-medium">Request Data Deletion</span>
          </div>
          <Separator />
          <div className="px-4 py-3 space-y-3">
            {loadingReq ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : delRequest ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {requestStatusIcon(delRequest.status)}
                  <span className="text-sm font-medium capitalize">{delRequest.status}</span>
                </div>
                {delRequest.admin_note && (
                  <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                    {delRequest.admin_note}
                  </p>
                )}
                {delRequest.status === "pending" && (
                  <p className="text-[11px] text-muted-foreground">
                    Your request is under review. The admin will notify you once a decision is made.
                  </p>
                )}
                {delRequest.status === "declined" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs mt-1"
                    onClick={() => setDelRequest(null)}
                  >
                    Submit New Request
                  </Button>
                )}
              </div>
            ) : (
              <>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Request permanent deletion of all your data from our systems. The admin will review
                  and respond within 30 days. You will be notified via the bot.
                </p>
                <Textarea
                  placeholder="Please explain why you want your data deleted (required)…"
                  className="text-xs min-h-[80px] resize-none"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground text-right">{reason.length}/500</p>
                <Button
                  size="sm"
                  variant="destructive"
                  className="w-full h-8 text-xs"
                  disabled={submitting || reason.trim().length < 10}
                  onClick={submitRequest}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Submit Deletion Request
                </Button>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground pb-2">
          <a href="https://mini.susagar.sbs/api/privacy" target="_blank" rel="noreferrer" className="underline">
            Privacy Policy &amp; Terms
          </a>
          {" · "}
          <a href="https://t.me/lifegrambot" target="_blank" rel="noreferrer" className="underline">
            @lifegrambot
          </a>
        </p>
      </div>
    </Layout>
  );
}
