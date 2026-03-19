import { ReactNode, useEffect } from "react";
import { useTelegram } from "@/lib/telegram-context";
import { useGetMyProfile } from "@workspace/api-client-react";
import { Loader2, MessageSquare } from "lucide-react";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { initData, isReady, setProfile } = useTelegram();

  // If we're fully initialized but no initData is present, they aren't in Telegram
  if (isReady && !initData) {
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

  return <ProfileLoader initData={initData}>{children}</ProfileLoader>;
}

function ProfileLoader({ initData, children }: { initData: string; children: ReactNode }) {
  const { setProfile } = useTelegram();
  
  const { data: profile, isLoading, error } = useGetMyProfile({
    request: { headers: { "X-Init-Data": initData } },
    query: {
      enabled: !!initData,
      retry: false
    }
  });

  useEffect(() => {
    if (profile) {
      setProfile(profile);
    }
  }, [profile, setProfile]);

  if (isLoading || !initData) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Connecting to server...</p>
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
        <p className="text-muted-foreground">Failed to authenticate with the server. Please try restarting the Mini App.</p>
      </div>
    );
  }

  return <>{children}</>;
}
