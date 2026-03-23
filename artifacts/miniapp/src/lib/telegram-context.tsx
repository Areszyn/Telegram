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
  showBackButton: (cb: () => void) => void;
  hideBackButton: () => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  showPopup: (params: { title?: string; message: string; buttons?: PopupButton[] }, cb?: (id: string) => void) => void;
  showAlert: (message: string, cb?: () => void) => void;
  showConfirm: (message: string, cb?: (ok: boolean) => void) => void;
  showScanQrPopup: (params?: { text?: string }, cb?: (data: string) => boolean | void) => void;
  closeScanQrPopup: () => void;
  readClipboard: (cb?: (text: string | null) => void) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  openInvoice: (url: string, cb?: (status: string) => void) => void;
  switchInlineQuery: (query: string, chooseChatTypes?: string[]) => void;
  cloudStorageSet: (key: string, value: string, cb?: (err: Error | null) => void) => void;
  cloudStorageGet: (key: string, cb?: (err: Error | null, value?: string) => void) => void;
  cloudStorageRemove: (key: string, cb?: (err: Error | null) => void) => void;
  themeParams: Record<string, string>;
  colorScheme: "light" | "dark";
  platform: string;
  version: string;
}

type PopupButton = { id?: string; type?: "default" | "ok" | "close" | "cancel" | "destructive"; text?: string };

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
  showBackButton: () => {},
  hideBackButton: () => {},
  enableClosingConfirmation: () => {},
  disableClosingConfirmation: () => {},
  showPopup: () => {},
  showAlert: () => {},
  showConfirm: () => {},
  showScanQrPopup: () => {},
  closeScanQrPopup: () => {},
  readClipboard: () => {},
  openLink: () => {},
  openTelegramLink: () => {},
  openInvoice: () => {},
  switchInlineQuery: () => {},
  cloudStorageSet: () => {},
  cloudStorageGet: () => {},
  cloudStorageRemove: () => {},
  themeParams: {},
  colorScheme: "dark",
  platform: "",
  version: "",
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

function applyThemeVars(params: Record<string, string>) {
  if (!params) return;
  Object.entries(params).forEach(([key, val]) => {
    const cssVar = `--tg-theme-${key.replace(/_/g, "-")}`;
    document.documentElement.style.setProperty(cssVar, val);
  });
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [initData, setInitData] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isInsideTelegram, setIsInsideTelegram] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [themeParams, setThemeParams] = useState<Record<string, string>>({});
  const [colorScheme, setColorScheme] = useState<"light" | "dark">("dark");
  const [platform, setPlatform] = useState("");
  const [version, setVersion] = useState("");

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
      setPlatform(tg.platform ?? "");
      setVersion(tg.version ?? "");
      setColorScheme(tg.colorScheme ?? "dark");

      if (tg.themeParams) {
        setThemeParams(tg.themeParams);
        applyThemeVars(tg.themeParams);
      }

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
        tg.onEvent("themeChanged", () => {
          const t = getTg();
          if (t?.themeParams) {
            setThemeParams(t.themeParams);
            applyThemeVars(t.themeParams);
          }
          setColorScheme(t?.colorScheme ?? "dark");
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

  const backButtonCbRef = { current: null as (() => void) | null };

  const showBackButton = useCallback((cb: () => void) => {
    try {
      const tg = getTg();
      if (tg?.BackButton) {
        if (backButtonCbRef.current) {
          tg.BackButton.offClick(backButtonCbRef.current);
        }
        backButtonCbRef.current = cb;
        tg.BackButton.onClick(cb);
        tg.BackButton.show();
      }
    } catch (_) {}
  }, []);

  const hideBackButton = useCallback(() => {
    try {
      const tg = getTg();
      if (tg?.BackButton) {
        if (backButtonCbRef.current) {
          tg.BackButton.offClick(backButtonCbRef.current);
          backButtonCbRef.current = null;
        }
        tg.BackButton.hide();
      }
    } catch (_) {}
  }, []);

  const enableClosingConfirmation = useCallback(() => {
    try { getTg()?.enableClosingConfirmation?.(); } catch (_) {}
  }, []);

  const disableClosingConfirmation = useCallback(() => {
    try { getTg()?.disableClosingConfirmation?.(); } catch (_) {}
  }, []);

  const showPopup = useCallback((params: { title?: string; message: string; buttons?: PopupButton[] }, cb?: (id: string) => void) => {
    try { getTg()?.showPopup?.(params, cb); } catch (_) {}
  }, []);

  const showAlert = useCallback((message: string, cb?: () => void) => {
    try { getTg()?.showAlert?.(message, cb); } catch (_) {}
  }, []);

  const showConfirm = useCallback((message: string, cb?: (ok: boolean) => void) => {
    try { getTg()?.showConfirm?.(message, cb); } catch (_) {}
  }, []);

  const showScanQrPopup = useCallback((params?: { text?: string }, cb?: (data: string) => boolean | void) => {
    try { getTg()?.showScanQrPopup?.(params, cb); } catch (_) {}
  }, []);

  const closeScanQrPopup = useCallback(() => {
    try { getTg()?.closeScanQrPopup?.(); } catch (_) {}
  }, []);

  const readClipboard = useCallback((cb?: (text: string | null) => void) => {
    try { getTg()?.readTextFromClipboard?.((text: string | null) => cb?.(text)); } catch (_) {}
  }, []);

  const openLink = useCallback((url: string, options?: { try_instant_view?: boolean }) => {
    try { getTg()?.openLink?.(url, options); } catch (_) {
      window.open(url, "_blank");
    }
  }, []);

  const openTelegramLink = useCallback((url: string) => {
    try { getTg()?.openTelegramLink?.(url); } catch (_) {}
  }, []);

  const openInvoice = useCallback((url: string, cb?: (status: string) => void) => {
    try { getTg()?.openInvoice?.(url, cb); } catch (_) {}
  }, []);

  const switchInlineQuery = useCallback((query: string, chooseChatTypes?: string[]) => {
    try { getTg()?.switchInlineQuery?.(query, chooseChatTypes); } catch (_) {}
  }, []);

  const cloudStorageSet = useCallback((key: string, value: string, cb?: (err: Error | null) => void) => {
    try { getTg()?.CloudStorage?.setItem?.(key, value, cb); } catch (_) {}
  }, []);

  const cloudStorageGet = useCallback((key: string, cb?: (err: Error | null, value?: string) => void) => {
    try { getTg()?.CloudStorage?.getItem?.(key, cb); } catch (_) {}
  }, []);

  const cloudStorageRemove = useCallback((key: string, cb?: (err: Error | null) => void) => {
    try { getTg()?.CloudStorage?.removeItem?.(key, cb); } catch (_) {}
  }, []);

  return (
    <TelegramContext.Provider value={{
      initData, isReady, isInsideTelegram, isFullscreen,
      profile, setProfile,
      requestFullscreen, exitFullscreen, addToHomeScreen,
      requestWriteAccess, shareText, haptic,
      showBackButton, hideBackButton,
      enableClosingConfirmation, disableClosingConfirmation,
      showPopup, showAlert, showConfirm,
      showScanQrPopup, closeScanQrPopup,
      readClipboard, openLink, openTelegramLink, openInvoice,
      switchInlineQuery,
      cloudStorageSet, cloudStorageGet, cloudStorageRemove,
      themeParams, colorScheme, platform, version,
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
