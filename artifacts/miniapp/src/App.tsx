import { useState, useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

// Providers & Guards
import { TelegramProvider, useTelegram, useApiAuth } from "@/lib/telegram-context";
import { AuthGuard } from "@/pages/auth-guard";

// Cookie consent
import { CookieBanner } from "@/components/CookieBanner";

// User Pages
import { UserChat }       from "@/pages/user/chat";
import { DonatePage }     from "@/pages/user/donate";
import { UserSessionPage } from "@/pages/user/session";
import { UserAccount }    from "@/pages/user/account";

// Admin Pages
import { AdminInbox }            from "@/pages/admin/inbox";
import { AdminChat }             from "@/pages/admin/chat";
import { AdminBroadcast }        from "@/pages/admin/broadcast";
import { AdminDonations }        from "@/pages/admin/donations";
import { AdminUsers }            from "@/pages/admin/users";
import { AdminModeration }       from "@/pages/admin/moderation";
import { AdminBotTools }         from "@/pages/admin/bot-tools";
import { AdminSessions }         from "@/pages/admin/sessions";
import { AdminDeletionRequests } from "@/pages/admin/deletion-requests";
import { AdminPlans }            from "@/pages/admin/plans";
import { AdminPayments }         from "@/pages/admin/payments";

// Shared Pages (admin + premium users)
import { GroupTools } from "@/pages/group-tools";
import { UserLiveChat } from "@/pages/user/live-chat";
import { AdminLiveChat } from "@/pages/admin/live-chat";
import { AdminPhishing } from "@/pages/admin/phishing";
import { TrapPage } from "@/pages/trap";
import { UserPayments } from "@/pages/user/payments";
import { WidgetSettings } from "@/pages/user/widget-settings";
import { WidgetInbox } from "@/pages/user/widget-inbox";
import { AdminWidgetManager } from "@/pages/admin/widget-admin";
import { AiChat } from "@/pages/user/ai-chat";
import { AiAdmin } from "@/pages/admin/ai-admin";

import { API_BASE } from "@/lib/api";
import { setApiBase } from "@workspace/api-client-react";

setApiBase(API_BASE);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const { profile } = useTelegram();
  const isAdmin = profile?.is_admin === true;

  if (isAdmin) {
    return (
      <Switch>
        <Route path="/admin"                   component={AdminInbox} />
        <Route path="/admin/chat/:userId"      component={AdminChat} />
        <Route path="/admin/broadcast"         component={AdminBroadcast} />
        <Route path="/admin/donations"         component={AdminDonations} />
        <Route path="/admin/users"             component={AdminUsers} />
        <Route path="/admin/moderation"        component={AdminModeration} />
        <Route path="/admin/bot-tools"         component={AdminBotTools} />
        <Route path="/admin/sessions"          component={AdminSessions} />
        <Route path="/admin/deletion-requests" component={AdminDeletionRequests} />
        <Route path="/admin/plans"             component={AdminPlans} />
        <Route path="/admin/payments"          component={AdminPayments} />
        <Route path="/admin/group-tools"       component={GroupTools} />
        <Route path="/admin/live-chat"         component={AdminLiveChat} />
        <Route path="/admin/phishing"          component={AdminPhishing} />
        <Route path="/admin/widget-settings"   component={WidgetSettings} />
        <Route path="/admin/widget-inbox"      component={WidgetInbox} />
        <Route path="/admin/widget-admin"      component={AdminWidgetManager} />
        <Route path="/admin/ai-chat"          component={AiChat} />
        <Route path="/admin/ai-admin"         component={AiAdmin} />
        <Route path="/">
          <Redirect to="/admin" />
        </Route>
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/"            component={UserChat} />
      <Route path="/donate"      component={DonatePage} />
      <Route path="/session"     component={UserSessionPage} />
      <Route path="/account"     component={UserAccount} />
      <Route path="/payments"    component={UserPayments} />
      <Route path="/group-tools" component={GroupTools} />
      <Route path="/live-chat"          component={UserLiveChat} />
      <Route path="/widget-settings"   component={WidgetSettings} />
      <Route path="/widget-inbox"      component={WidgetInbox} />
      <Route path="/ai-chat"          component={AiChat} />
      <Route path="/admin/*">
        <Redirect to="/" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function getStartParam(): string | null {
  try {
    const tg = (window as any).Telegram?.WebApp;
    const sp = tg?.initDataUnsafe?.start_param;
    if (sp && typeof sp === "string" && sp.startsWith("p_")) return sp.slice(2);
  } catch {}
  return null;
}

function AppInner() {
  const { profile } = useTelegram();
  const { headers: authHeaders } = useApiAuth() as { headers: Record<string, string> };
  const telegramId  = profile?.telegram_id;

  const trapCode = getStartParam();
  if (trapCode) {
    return <TrapPage code={trapCode} />;
  }

  return (
    <>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AppRoutes />
      </WouterRouter>
      {!profile?.is_admin && (
        <CookieBanner telegramId={telegramId} apiBase={API_BASE} authHeaders={authHeaders} />
      )}
    </>
  );
}

const NOTICE_ICONS: Record<string, string> = {
  warning: "⚠️",
  info: "ℹ️",
  update: "🔄",
  maintenance: "🔧",
};

function buildIframeDoc(raw: string): string {
  const noScript = raw.replace(/<script[\s\S]*?<\/script>/gi, "");
  const hasFullPage = /<html[\s>]/i.test(noScript);
  if (hasFullPage) {
    return noScript
      .replace(/<head>/i, '<head><meta name="viewport" content="width=device-width,initial-scale=1">')
      .replace(/<body/i, '<body style="margin:0;padding:0"');
  }
  const hasStyle = /<style[\s>]/i.test(noScript);
  const hasBody = /<body[\s>]/i.test(noScript);
  if (hasStyle || hasBody) {
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>${hasBody ? noScript : `<body>${noScript}</body>`}</html>`;
  }
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0">${noScript}</body></html>`;
}

function HtmlIframe({ html, className, maxH = 600 }: { html: string; className?: string; maxH?: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(buildIframeDoc(html));
    doc.close();
    const resize = () => {
      const h = doc.documentElement?.scrollHeight || doc.body?.scrollHeight || 200;
      setHeight(Math.min(h + 2, maxH));
    };
    setTimeout(resize, 50);
    setTimeout(resize, 200);
    setTimeout(resize, 600);
  }, [html, maxH]);

  return (
    <iframe
      ref={ref}
      sandbox="allow-same-origin"
      className={className}
      style={{ width: "100%", height: `${height}px`, border: "none", borderRadius: "16px", overflow: "hidden", background: "transparent" }}
    />
  );
}

function AppNotice({ notice, onContinue }: { notice: { title: string; message: string; type: string }; onContinue: () => void }) {
  const isHtml = /<[a-z][\s\S]*>/i.test(notice.message);
  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6 overflow-y-auto">
      <div className="max-w-sm w-full text-center space-y-4">
        {isHtml ? (
          <>
            <HtmlIframe html={notice.message} maxH={500} />
            <button
              onClick={onContinue}
              className="w-full py-2.5 px-4 bg-foreground text-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              I Understand, Continue
            </button>
          </>
        ) : (
          <>
            <div className="text-5xl">{NOTICE_ICONS[notice.type] ?? "⚠️"}</div>
            <h2 className="text-lg font-bold tracking-tight">{notice.title}</h2>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {notice.message}
            </div>
            <button
              onClick={onContinue}
              className="w-full py-2.5 px-4 bg-foreground text-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              I Understand, Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function AppWithNotice() {
  const { profile } = useTelegram();
  const isAdmin = profile?.is_admin === true;
  const [notice, setNotice] = useState<{ title: string; message: string; type: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(!isAdmin);

  useEffect(() => {
    if (isAdmin) { setLoading(false); return; }
    fetch(`${API_BASE}/app-notice`)
      .then(r => r.json())
      .then(d => { if (d.notice) setNotice(d.notice); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (notice && !dismissed && !isAdmin) {
    return <AppNotice notice={notice} onContinue={() => setDismissed(true)} />;
  }

  return <AppInner />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TelegramProvider>
          <AuthGuard>
            <AppWithNotice />
          </AuthGuard>
        </TelegramProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
