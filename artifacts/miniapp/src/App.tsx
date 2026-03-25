import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

// Providers & Guards
import { TelegramProvider, useTelegram } from "@/lib/telegram-context";
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

// Shared Pages (admin + premium users)
import { GroupTools } from "@/pages/group-tools";
import { VersionsPage } from "@/pages/versions";
import { SystemStatus } from "@/pages/admin/system-status";
import { UserLiveChat } from "@/pages/user/live-chat";
import { AdminLiveChat } from "@/pages/admin/live-chat";
import { AdminPhishing } from "@/pages/admin/phishing";
import { TrapPage } from "@/pages/trap";
import { WidgetSettings } from "@/pages/user/widget-settings";
import { WidgetInbox } from "@/pages/user/widget-inbox";

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
        <Route path="/admin/group-tools"       component={GroupTools} />
        <Route path="/admin/versions"          component={VersionsPage} />
        <Route path="/admin/status"            component={SystemStatus} />
        <Route path="/admin/live-chat"         component={AdminLiveChat} />
        <Route path="/admin/phishing"          component={AdminPhishing} />
        <Route path="/admin/widget-settings"   component={WidgetSettings} />
        <Route path="/admin/widget-inbox"      component={WidgetInbox} />
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
      <Route path="/group-tools" component={GroupTools} />
      <Route path="/live-chat"          component={UserLiveChat} />
      <Route path="/widget-settings"   component={WidgetSettings} />
      <Route path="/widget-inbox"      component={WidgetInbox} />
      <Route path="/versions"          component={VersionsPage} />
      <Route path="/status"            component={SystemStatus} />
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
        <CookieBanner telegramId={telegramId} apiBase={API_BASE} />
      )}
    </>
  );
}

function App() {
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
