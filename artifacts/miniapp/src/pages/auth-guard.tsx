import { ReactNode, useEffect } from "react";
import { useTelegram } from "@/lib/telegram-context";
import { useGetMyProfile } from "@workspace/api-client-react";
import { Loader2, MessageSquare, ShieldBan, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { initData, isReady, isInsideTelegram } = useTelegram();

  if (!isReady) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Starting…</p>
      </div>
    );
  }

  if (!isInsideTelegram) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-primary/20">
          <MessageSquare className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3 tracking-tight">Open in Telegram</h1>
        <p className="text-muted-foreground max-w-sm leading-relaxed">
          This application is designed to be run exclusively as a Telegram Mini App.
        </p>
      </div>
    );
  }

  if (!initData) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Connecting…</p>
      </div>
    );
  }

  return <ProfileLoader initData={initData}>{children}</ProfileLoader>;
}

function ProfileLoader({ initData, children }: { initData: string; children: ReactNode }) {
  const { setProfile } = useTelegram();

  const { data: profile, isLoading, error } = useGetMyProfile({
    request: { headers: { "X-Init-Data": initData } },
    query: { enabled: !!initData, retry: 2 },
  });

  useEffect(() => {
    if (profile) setProfile(profile);
  }, [profile, setProfile]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading profile…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-destructive/10 p-4 rounded-full mb-4">
          <MessageSquare className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Connection Error</h2>
        <p className="text-muted-foreground text-sm">Could not reach the server. Please close and reopen the app.</p>
      </div>
    );
  }

  // App-banned or globally banned
  const p = profile as any;
  if (p?.is_banned) {
    return <BannedScreen reason={p.ban_reason} banUntil={p.ban_until} />;
  }

  return <>{children}</>;
}

function BannedScreen({ reason, banUntil }: { reason?: string | null; banUntil?: string | null }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-red-500/10 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-red-500/20">
        <ShieldBan className="w-12 h-12 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-3 tracking-tight">Access Denied</h1>
      <p className="text-muted-foreground mb-6 max-w-sm leading-relaxed">
        You are banned from this service.
      </p>
      {reason && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 mb-4 max-w-sm w-full">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Reason</p>
          </div>
          <p className="text-sm text-foreground/80">{reason}</p>
        </div>
      )}
      {banUntil && (
        <p className="text-xs text-muted-foreground">
          Ban expires: {format(new Date(banUntil), "MMM d, yyyy · HH:mm")}
        </p>
      )}
      <p className="text-xs text-muted-foreground mt-6">
        If you believe this is a mistake, contact the admin.
      </p>
    </div>
  );
}
