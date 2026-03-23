import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { UserProfile } from "@workspace/api-client-react";

interface TelegramContextState {
  initData: string;
  isReady: boolean;
  isInsideTelegram: boolean;
  isFullscreen: boolean;
  profile: UserProfile | null;
  setProfile: (profile: UserProfile) => void;
  requestFullscreen: () => void;
  exitFullscreen: () => void;
  addToHomeScreen: () => void;
  requestWriteAccess: (cb?: (granted: boolean) => void) => void;
  shareText: (text: string) => void;
  haptic: (type?: "light" | "medium" | "heavy") => void;
}

const TelegramContext = createContext<TelegramContextState>({
  initData: "",
  isReady: false,
  isInsideTelegram: false,
  isFullscreen: false,
  profile: null,
  setProfile: () => {},
  requestFullscreen: () => {},
  exitFullscreen: () => {},
  addToHomeScreen: () => {},
  requestWriteAccess: () => {},
  shareText: () => {},
  haptic: () => {},
});

function getTg(): any {
  return (window as any).Telegram?.WebApp ?? null;
}

function applyViewportHeight() {
  try {
    const tg = getTg();
    const vh =
      tg?.viewportStableHeight ??
      tg?.viewportHeight ??
      window.visualViewport?.height ??
      window.innerHeight;
    document.documentElement.style.setProperty("--app-height", `${vh}px`);

    const sa = tg?.safeAreaInset;
    const csa = tg?.contentSafeAreaInset;
    if (sa) {
      document.documentElement.style.setProperty("--safe-top", `${sa.top ?? 0}px`);
      document.documentElement.style.setProperty("--safe-bottom", `${sa.bottom ?? 0}px`);
      document.documentElement.style.setProperty("--safe-left", `${sa.left ?? 0}px`);
      document.documentElement.style.setProperty("--safe-right", `${sa.right ?? 0}px`);
    }
    if (csa) {
      document.documentElement.style.setProperty("--content-safe-top", `${csa.top ?? 0}px`);
      document.documentElement.style.setProperty("--content-safe-bottom", `${csa.bottom ?? 0}px`);
    }
  } catch (_) {}
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [initData, setInitData] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isInsideTelegram, setIsInsideTelegram] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let attempts = 0;
    const MAX_ATTEMPTS = 50;

    function tryInit() {
      const tg = getTg();

      if (!tg) {
        attempts++;
        if (attempts < MAX_ATTEMPTS) setTimeout(tryInit, 100);
        else { setIsInsideTelegram(false); setIsReady(true); }
        return;
      }

      setIsInsideTelegram(true);

      try { tg.ready(); } catch (_) {}
      try { tg.expand(); } catch (_) {}
      try { if (typeof tg.setHeaderColor === "function") tg.setHeaderColor("secondary_bg_color"); } catch (_) {}
      try { if (typeof tg.setBackgroundColor === "function") tg.setBackgroundColor("bg_color"); } catch (_) {}
      try { if (typeof tg.setBottomBarColor === "function") tg.setBottomBarColor("secondary_bg_color"); } catch (_) {}
      try { if (typeof tg.disableVerticalSwipes === "function") tg.disableVerticalSwipes(); } catch (_) {}

      applyViewportHeight();

      try {
        tg.onEvent("viewportChanged", applyViewportHeight);
        tg.onEvent("safeAreaChanged", applyViewportHeight);
        tg.onEvent("contentSafeAreaChanged", applyViewportHeight);
        tg.onEvent("fullscreenChanged", () => {
          setIsFullscreen(!!(getTg()?.isFullscreen));
          applyViewportHeight();
        });
      } catch (_) {}

      try {
        if (typeof tg.requestFullscreen === "function") {
          tg.requestFullscreen();
          setIsFullscreen(!!(tg.isFullscreen));
        }
      } catch (_) {}

      if (tg.initData) {
        setInitData(tg.initData);
        setIsReady(true);
        return;
      }

      attempts++;
      if (attempts < MAX_ATTEMPTS) setTimeout(tryInit, 100);
      else setIsReady(true);
    }

    tryInit();
  }, []);

  const requestFullscreen = useCallback(() => {
    try { getTg()?.requestFullscreen?.(); } catch (_) {}
  }, []);

  const exitFullscreen = useCallback(() => {
    try { getTg()?.exitFullscreen?.(); } catch (_) {}
  }, []);

  const addToHomeScreen = useCallback(() => {
    try { getTg()?.addToHomeScreen?.(); } catch (_) {}
  }, []);

  const requestWriteAccess = useCallback((cb?: (granted: boolean) => void) => {
    try {
      getTg()?.requestWriteAccess?.((granted: boolean) => cb?.(granted));
    } catch (_) { cb?.(false); }
  }, []);

  const shareText = useCallback((text: string) => {
    try {
      const tg = getTg();
      if (tg?.shareMessage) {
        tg.shareMessage({ text });
      } else if (tg?.openTelegramLink) {
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(text)}`);
      } else {
        window.open(`https://t.me/share/url?url=${encodeURIComponent(text)}`, "_blank");
      }
    } catch (_) {}
  }, []);

  const haptic = useCallback((type: "light" | "medium" | "heavy" = "light") => {
    try { getTg()?.HapticFeedback?.impactOccurred(type); } catch (_) {}
  }, []);

  return (
    <TelegramContext.Provider value={{
      initData, isReady, isInsideTelegram, isFullscreen,
      profile, setProfile,
      requestFullscreen, exitFullscreen, addToHomeScreen,
      requestWriteAccess, shareText, haptic,
    }}>
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
