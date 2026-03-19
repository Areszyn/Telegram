import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { UserProfile } from "@workspace/api-client-react";

interface TelegramContextState {
  initData: string;
  isReady: boolean;
  profile: UserProfile | null;
  setProfile: (profile: UserProfile) => void;
}

const TelegramContext = createContext<TelegramContextState>({
  initData: "",
  isReady: false,
  profile: null,
  setProfile: () => {},
});

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [initData, setInitData] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    // Access the global Telegram WebApp object
    const tg = (window as any).Telegram?.WebApp;
    
    if (tg) {
      tg.ready();
      tg.expand();
      
      // Set the theme color to match our dark theme
      tg.setHeaderColor?.('#1a1a1b');
      tg.setBackgroundColor?.('#1a1a1b');
      
      if (tg.initData) {
        setInitData(tg.initData);
      }
    }
    
    setIsReady(true);
  }, []);

  return (
    <TelegramContext.Provider value={{ initData, isReady, profile, setProfile }}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram() {
  return useContext(TelegramContext);
}

// Helper to generate request options with auth header for Orval hooks
export function useApiAuth() {
  const { initData } = useTelegram();
  return {
    headers: {
      "X-Init-Data": initData,
    },
  };
}
