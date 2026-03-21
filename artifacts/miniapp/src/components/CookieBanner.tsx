import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

const CONSENT_KEY = "cookie_consent_v1";

export function useCookieConsent() {
  const [consent, setConsent] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(CONSENT_KEY) : null
  );
  const update = (value: "accepted" | "declined") => {
    localStorage.setItem(CONSENT_KEY, value);
    setConsent(value);
  };
  return { consent, update };
}

interface CookieBannerProps {
  telegramId?: string | number;
  apiBase: string;
}

export function CookieBanner({ telegramId, apiBase }: CookieBannerProps) {
  const { consent, update } = useCookieConsent();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!consent) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [consent]);

  const handle = async (choice: "accepted" | "declined") => {
    setVisible(false);
    update(choice);
    if (telegramId) {
      try {
        await fetch(`${apiBase}/user/device-info`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telegram_id: telegramId,
            cookie_consent: choice,
            platform: navigator.platform,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screen: `${window.screen.width}x${window.screen.height}`,
          }),
        });
      } catch { /* non-critical */ }
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2"
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 max-w-lg mx-auto">
            <div className="flex gap-3">
              <div className="shrink-0 w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Cookie className="h-4 w-4 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground mb-0.5">We use cookies &amp; collect data</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  We collect your IP address, device info, and usage data to operate and improve this service.
                  See our{" "}
                  <a
                    href="https://mini.susagar.sbs/api/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-primary"
                  >
                    Privacy Policy
                  </a>
                  .
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-3">
              <Button
                size="sm"
                className="w-full h-9 text-xs"
                onClick={() => handle("accepted")}
              >
                Accept All
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="w-full h-9 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => handle("declined")}
              >
                Decline & continue with essential only
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
