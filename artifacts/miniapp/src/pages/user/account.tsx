import { useState, useEffect } from "react";
import { useTelegram, useApiAuth } from "@/lib/telegram-context";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useCookieConsent } from "@/components/CookieBanner";
import {
  User, Shield, Trash2, Cookie, ExternalLink,
  CheckCircle, Clock, XCircle,
} from "lucide-react";

import { API_BASE } from "@/lib/api";

type DeleteRequest = {
  id: number;
  status: "pending" | "approved" | "declined";
  admin_note?: string;
  created_at: string;
} | null;

export function UserAccount() {
  const { profile }       = useTelegram();
  const reqOpts           = useApiAuth();
  const headers           = reqOpts.headers as Record<string, string>;
  const { consent, update } = useCookieConsent();

  const [reason, setReason]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [delRequest, setDelRequest] = useState<DeleteRequest>(undefined as unknown as DeleteRequest);
  const [loadingReq, setLoadingReq] = useState(true);

  const telegramId = profile?.telegram_id;

  // Load existing deletion request
  useEffect(() => {
    if (!telegramId) return;
    fetch(`${API_BASE}/user/deletion-request?telegram_id=${telegramId}`, { headers })
      .then(r => r.json())
      .then(d => setDelRequest(d))
      .catch(() => setDelRequest(null))
      .finally(() => setLoadingReq(false));
  }, [telegramId]);

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
        body: JSON.stringify({ telegram_id: telegramId, reason: reason.trim() }),
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
    if (status === "approved")  return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    if (status === "declined")  return <XCircle className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-amber-500" />;
  };

  return (
    <Layout title="My Account">
      <div className="h-full overflow-y-auto p-4 space-y-4">

        {/* Profile card */}
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">
              {profile?.first_name ?? "User"}
              {profile?.username ? <span className="text-muted-foreground font-normal"> @{profile.username}</span> : null}
            </p>
            <p className="text-[11px] text-muted-foreground">Telegram ID: {telegramId}</p>
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
            <Cookie className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-sm font-medium">Cookie &amp; Data Consent</span>
            <div className="ml-auto">
              {consent === "accepted" && <Badge variant="outline" className="text-emerald-500 border-emerald-500/40 text-[10px]">Accepted</Badge>}
              {consent === "declined" && <Badge variant="outline" className="text-muted-foreground text-[10px]">Declined</Badge>}
              {!consent && <Badge variant="outline" className="text-amber-500 border-amber-500/40 text-[10px]">Pending</Badge>}
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
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        telegram_id: telegramId,
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
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ telegram_id: telegramId, cookie_consent: "declined" }),
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
            <Trash2 className="h-4 w-4 text-red-500 shrink-0" />
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
