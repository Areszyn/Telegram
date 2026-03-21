import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { MessageCircle, CreditCard, Inbox, Radio, DollarSign, Users, ShieldBan } from "lucide-react";
import { useTelegram } from "@/lib/telegram-context";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";

export function Layout({ children, title }: { children: ReactNode; title?: string }) {
  const { profile } = useTelegram();
  const [location] = useLocation();
  const isAdmin = profile?.is_admin === true;

  const userTabs = [
    { href: "/",       label: "Chat",   icon: MessageCircle },
    { href: "/donate", label: "Donate", icon: CreditCard },
  ];

  const adminTabs = [
    { href: "/admin",             label: "Inbox",     icon: Inbox },
    { href: "/admin/broadcast",   label: "Broadcast", icon: Radio },
    { href: "/admin/donations",   label: "Donations", icon: DollarSign },
    { href: "/admin/users",       label: "Users",     icon: Users },
    { href: "/admin/moderation",  label: "Mod",       icon: ShieldBan },
  ];

  const tabs = isAdmin ? adminTabs : userTabs;

  const isActive = (href: string) => {
    if (href === "/admin") return location === "/admin";
    return location.startsWith(href);
  };

  return (
    <div className="flex flex-col h-screen min-h-safe bg-background text-foreground overflow-hidden">
      {title && (
        <>
          <header className="flex-none pt-safe px-4 py-3 bg-background">
            <h1 className="text-base font-semibold tracking-tight">{title}</h1>
          </header>
          <Separator />
        </>
      )}

      <main className="flex-1 overflow-hidden bg-background">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="h-full w-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <Separator />
      <nav className="flex-none bg-background pb-safe">
        <div className="flex px-1 py-1.5">
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl gap-1 transition-colors relative",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
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
                  "h-5 w-5 transition-all relative z-10",
                  active && "scale-110"
                )} />
                <span className={cn(
                  "text-[10px] font-medium leading-none relative z-10",
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
