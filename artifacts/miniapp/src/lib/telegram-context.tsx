import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { UserProfile } from "@workspace/api-client-react";

interface TelegramContextState {
  initData: string;
  isReady: boolean;
  isInsideTelegram: boolean;
  profile: UserProfile | null;
  setProfile: (profile: UserProfile) => void;
}

const TelegramContext = createContext<TelegramContextState>({
  initData: "",
  isReady: false,
  isInsideTelegram: false,
  profile: null,
  setProfile: () => {},
});

function getTg(): any {
  return (window as any).Telegram?.WebApp ?? null;
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [initData, setInitData] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isInsideTelegram, setIsInsideTelegram] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let attempts = 0;
    const MAX_ATTEMPTS = 50;
    const INTERVAL = 100;

    function tryInit() {
      const tg = getTg();

      if (!tg) {
        attempts++;
        if (attempts < MAX_ATTEMPTS) {
          setTimeout(tryInit, INTERVAL);
        } else {
          setIsInsideTelegram(false);
          setIsReady(true);
        }
        return;
      }

      setIsInsideTelegram(true);

      try {
        tg.ready();
        tg.expand();
      } catch (_) {}

      try {
        if (typeof tg.setHeaderColor === "function") tg.setHeaderColor("secondary_bg_color");
      } catch (_) {}
      try {
        if (typeof tg.setBackgroundColor === "function") tg.setBackgroundColor("bg_color");
      } catch (_) {}

      try {
        if (typeof tg.disableVerticalSwipes === "function") tg.disableVerticalSwipes();
      } catch (_) {}

      if (tg.initData) {
        setInitData(tg.initData);
        setIsReady(true);

        try {
          const vh = tg.viewportHeight ?? tg.viewportStableHeight ?? window.visualViewport?.height ?? window.innerHeight;
          document.documentElement.style.setProperty("--app-height", `${vh}px`);
        } catch (_) {}

        return;
      }

      attempts++;
      if (attempts < MAX_ATTEMPTS) {
        setTimeout(tryInit, INTERVAL);
      } else {
        setIsReady(true);
      }
    }

    tryInit();
  }, []);

  return (
    <TelegramContext.Provider value={{ initData, isReady, isInsideTelegram, profile, setProfile }}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram() {
  return useContext(TelegramContext);
}

export function useApiAuth() {
  const { initData } = useTelegram();
  return {
    headers: {
      "X-Init-Data": initData,
    },
  };
}
