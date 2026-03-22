import { ReactNode, useEffect } from "react";
import { useTelegram } from "@/lib/telegram-context";
import { useGetMyProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, MessageSquare, ShieldBan, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { initData, isReady, isInsideTelegram } = useTelegram();

  if (!isReady) {
    return (
      <div className="flex items-center justify-center bg-background" style={{ height: "var(--app-height, 100vh)" }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isInsideTelegram) {
    return (
      <div className="flex items-center justify-center p-6 bg-background" style={{ height: "var(--app-height, 100vh)" }}>
        <Card className="w-full max-w-sm text-center">
          <CardHeader className="items-center pb-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-2">
              <MessageSquare className="h-7 w-7 text-muted-foreground" />
            </div>
            <CardTitle>Open in Telegram</CardTitle>
            <CardDescription>
              This app is designed to run exclusively as a Telegram Mini App.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!initData) {
    return (
      <div className="flex items-center justify-center bg-background" style={{ height: "var(--app-height, 100vh)" }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Connecting...</p>
        </div>
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
      <div className="p-6 space-y-4 bg-background" style={{ height: "var(--app-height, 100vh)" }}>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-6 bg-background" style={{ height: "var(--app-height, 100vh)" }}>
        <Card className="w-full max-w-sm text-center">
          <CardHeader className="items-center">
            <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <MessageSquare className="h-7 w-7 text-destructive" />
            </div>
            <CardTitle>Connection Error</CardTitle>
            <CardDescription>
              Could not reach the server. Please close and reopen the app.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const p = profile as any;
  if (p?.is_banned) {
    return <BannedScreen reason={p.ban_reason} banUntil={p.ban_until} />;
  }

  return <>{children}</>;
}

function BannedScreen({ reason, banUntil }: { reason?: string | null; banUntil?: string | null }) {
  return (
    <div className="flex items-center justify-center p-6 bg-background" style={{ height: "var(--app-height, 100vh)" }}>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center pb-3">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
            <ShieldBan className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>You are banned from this service.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {reason && (
            <Card className="bg-destructive/5 border-destructive/20">
              <CardContent className="p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-destructive mb-0.5">Reason</p>
                  <p className="text-sm text-foreground/80">{reason}</p>
                </div>
              </CardContent>
            </Card>
          )}
          {banUntil && (
            <p className="text-xs text-center text-muted-foreground">
              Ban expires {format(new Date(banUntil), "MMM d, yyyy · HH:mm")}
            </p>
          )}
          <p className="text-xs text-center text-muted-foreground">
            If you believe this is a mistake, contact the admin.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
