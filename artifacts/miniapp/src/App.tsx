import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

// Providers & Guards
import { TelegramProvider, useTelegram } from "@/lib/telegram-context";
import { AuthGuard } from "@/pages/auth-guard";

// User Pages
import { UserChat } from "@/pages/user/chat";
import { DonatePage } from "@/pages/user/donate";

// Admin Pages
import { AdminInbox } from "@/pages/admin/inbox";
import { AdminChat } from "@/pages/admin/chat";
import { AdminBroadcast } from "@/pages/admin/broadcast";

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
        <Route path="/admin" component={AdminInbox} />
        <Route path="/admin/chat/:userId" component={AdminChat} />
        <Route path="/admin/broadcast" component={AdminBroadcast} />
        {/* Redirect root to admin inbox if they navigate manually */}
        <Route path="/">
          <Redirect to="/admin" />
        </Route>
        <Route component={NotFound} />
      </Switch>
    );
  }

  // User Routes
  return (
    <Switch>
      <Route path="/" component={UserChat} />
      <Route path="/donate" component={DonatePage} />
      {/* Redirect any admin attempts */}
      <Route path="/admin/*">
        <Redirect to="/" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TelegramProvider>
          <AuthGuard>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRoutes />
            </WouterRouter>
          </AuthGuard>
        </TelegramProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
