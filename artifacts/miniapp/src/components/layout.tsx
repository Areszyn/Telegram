import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { MessageCircle, CreditCard, Inbox, Radio, DollarSign, Users, ShieldBan, Wrench, KeyRound, UserCircle, Trash2, ShieldX, Zap, Link2, MessageSquare, Settings, Bot, ChevronLeft, Crown, Receipt } from "lucide-react";
import { useTelegram } from "@/lib/telegram-context";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";

function useViewportHeight() {
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      try { tg.expand(); } catch (_) {}
      try { tg.requestFullscreen?.(); } catch (_) {}
      try { tg.disableVerticalSwipes?.(); } catch (_) {}
    }

    function applySafeAreas() {
      const tg = (window as any).Telegram?.WebApp;
      const sa = tg?.safeAreaInset ?? {};
      const csa = tg?.contentSafeAreaInset ?? {};
      const root = document.documentElement;
      root.style.setProperty("--tg-safe-area-inset-top", `${sa.top ?? 0}px`);
      root.style.setProperty("--tg-safe-area-inset-bottom", `${sa.bottom ?? 0}px`);
      root.style.setProperty("--tg-content-safe-area-inset-top", `${csa.top ?? 0}px`);
      root.style.setProperty("--tg-content-safe-area-inset-bottom", `${csa.bottom ?? 0}px`);
    }

    function setHeight() {
      const tg = (window as any).Telegram?.WebApp;
      const vh = tg?.viewportStableHeight ?? tg?.viewportHeight ?? window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${vh}px`);
      applySafeAreas();
    }

    setHeight();

    if (tg?.onEvent) {
      tg.onEvent("viewportChanged", setHeight);
      tg.onEvent("safeAreaChanged", applySafeAreas);
      tg.onEvent("contentSafeAreaChanged", applySafeAreas);
    }
    window.addEventListener("resize", setHeight);
    window.visualViewport?.addEventListener("resize", setHeight);

    return () => {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.offEvent) {
        tg.offEvent("viewportChanged", setHeight);
        tg.offEvent("safeAreaChanged", applySafeAreas);
        tg.offEvent("contentSafeAreaChanged", applySafeAreas);
      }
      window.removeEventListener("resize", setHeight);
      window.visualViewport?.removeEventListener("resize", setHeight);
    };
  }, []);
}

export function Layout({ children, title, backTo }: { children: ReactNode; title?: string; backTo?: string }) {
  const { profile, showBackButton, hideBackButton } = useTelegram();
  const [location, navigate] = useLocation();
  const isAdmin = profile?.is_admin === true;

  useViewportHeight();

  useEffect(() => {
    if (backTo) {
      showBackButton(() => navigate(backTo));
    } else {
      showBackButton(() => {
        try { (window as any).Telegram?.WebApp?.close(); } catch (_) {}
      });
    }
    return () => { hideBackButton(); };
  }, [backTo, showBackButton, hideBackButton, navigate]);

  const userTabs = [
    { href: "/",            label: "Chat",    icon: MessageCircle },
    { href: "/donate",      label: "Donate",  icon: CreditCard },
    { href: "/live-chat",   label: "Live",    icon: Zap },
    { href: "/widget-inbox",    label: "Widget",  icon: MessageSquare },
    { href: "/widget-settings", label: "Setup",   icon: Settings },
    { href: "/ai-chat",        label: "AI Chat", icon: Bot },
    { href: "/group-tools", label: "Groups",  icon: ShieldX },
    { href: "/payments",    label: "Payments", icon: Receipt },
    { href: "/account",     label: "Account", icon: UserCircle },
  ];

  const adminTabs = [
    { href: "/admin",                     label: "Inbox",     icon: Inbox },
    { href: "/admin/broadcast",           label: "Broadcast", icon: Radio },
    { href: "/admin/donations",           label: "Donations", icon: DollarSign },
    { href: "/admin/users",               label: "Users",     icon: Users },
    { href: "/admin/moderation",          label: "Mod",       icon: ShieldBan },
    { href: "/admin/deletion-requests",   label: "Deletions", icon: Trash2 },
    { href: "/admin/sessions",            label: "Sessions",  icon: KeyRound },
    { href: "/admin/live-chat",           label: "Live",      icon: Zap },
    { href: "/admin/ai-chat",            label: "AI Chat",   icon: Bot },
    { href: "/admin/ai-admin",           label: "AI Admin",  icon: Bot },
    { href: "/admin/group-tools",         label: "Groups",    icon: ShieldX },
    { href: "/admin/widget-inbox",        label: "Widget",    icon: MessageSquare },
    { href: "/admin/widget-settings",     label: "W.Setup",   icon: Settings },
    { href: "/admin/widget-admin",        label: "W.Admin",   icon: ShieldBan },
    { href: "/admin/plans",               label: "Plans",     icon: Crown },
    { href: "/admin/payments",            label: "Payments",  icon: Receipt },
    { href: "/admin/phishing",            label: "Phishing",  icon: Link2 },
    { href: "/admin/bot-tools",           label: "Tools",     icon: Wrench },
  ];

  const tabs = isAdmin ? adminTabs : userTabs;

  const isActive = (href: string) => {
    if (href === "/admin") return location === "/admin";
    return location.startsWith(href);
  };

  return (
    <div className="flex flex-col bg-background text-foreground overflow-hidden h-full w-full">
      {title && (
        <>
          <header
            className="flex-none px-4 py-2 bg-background flex items-center gap-2"
          >
            {backTo && (
              <Link href={backTo} className="shrink-0 -ml-1 p-1 rounded-lg active:bg-muted transition-colors">
                <ChevronLeft className="h-5 w-5 text-primary" />
              </Link>
            )}
            <h1 className="text-base font-semibold tracking-tight">{title}</h1>
          </header>
          <Separator />
        </>
      )}

      <main className="flex-1 overflow-hidden bg-background">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="h-full w-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <Separator />
      <nav className="flex-none bg-background">
        <div
          className="flex px-1 pt-1.5 overflow-x-auto scrollbar-none"
          style={{ paddingBottom: "calc(var(--tg-safe-area-inset-bottom, 0px) + 20px)" }}
        >
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl gap-1 transition-colors relative min-w-[52px] px-0.5",
                  active ? "text-primary" : "text-muted-foreground active:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active-bg"
                    className="absolute inset-0 rounded-xl bg-primary/10"
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
                <tab.icon className={cn(
                  "h-4.5 w-4.5 transition-all relative z-10",
                  active && "scale-110"
                )} />
                <span className={cn(
                  "text-[9px] font-medium leading-none relative z-10 whitespace-nowrap",
                  active ? "text-primary" : "text-muted-foreground"
                )}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
