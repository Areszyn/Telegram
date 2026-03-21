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
    const MAX_ATTEMPTS = 20; // 2 seconds total
    const INTERVAL = 100;

    function tryInit() {
      const tg = getTg();

      // Still no Telegram object yet — retry
      if (!tg) {
        attempts++;
        if (attempts < MAX_ATTEMPTS) {
          setTimeout(tryInit, INTERVAL);
        } else {
          // Truly not inside Telegram after waiting
          setIsInsideTelegram(false);
          setIsReady(true);
        }
        return;
      }

      // We have the Telegram WebApp object — we're inside Telegram
      setIsInsideTelegram(true);

      try {
        tg.ready();
        tg.expand();
        // Hex colors require Telegram client ≥ 6.9.
        // Older clients only accept named values ("bg_color" / "secondary_bg_color")
        // and will surface a native error toast for hex codes even when caught in JS.
        const tgMajor = parseInt((tg.version ?? "0").split(".")[0], 10);
        const tgMinor = parseInt(((tg.version ?? "0").split(".")[1] ?? "0"), 10);
        const supportsHexColor = tgMajor > 6 || (tgMajor === 6 && tgMinor >= 9);
        if (supportsHexColor) {
          tg.setHeaderColor?.("#1a1a1b");
          tg.setBackgroundColor?.("#1a1a1b");
        } else {
          tg.setHeaderColor?.("secondary_bg_color");
          tg.setBackgroundColor?.("bg_color");
        }
      } catch (_) {}

      if (tg.initData) {
        setInitData(tg.initData);
        setIsReady(true);
        return;
      }

      // initData not set yet — keep polling
      attempts++;
      if (attempts < MAX_ATTEMPTS) {
        setTimeout(tryInit, INTERVAL);
      } else {
        // We're inside Telegram but initData stayed empty (test environment?)
        // Mark ready so app can still render
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
