import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { MessageCircle, CreditCard, Inbox, Radio, DollarSign, Users } from "lucide-react";
import { useTelegram } from "@/lib/telegram-context";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { motion, AnimatePresence } from "framer-motion";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Layout({ children, title }: { children: ReactNode; title?: string }) {
  const { profile } = useTelegram();
  const [location] = useLocation();
  const isAdmin = profile?.is_admin === true;

  const userTabs = [
    { href: "/", label: "Chat", icon: MessageCircle },
    { href: "/donate", label: "Donate", icon: CreditCard },
  ];

  const adminTabs = [
    { href: "/admin", label: "Inbox", icon: Inbox },
    { href: "/admin/broadcast", label: "Broadcast", icon: Radio },
    { href: "/admin/donations", label: "Donations", icon: DollarSign },
    { href: "/admin/users", label: "Users", icon: Users },
  ];

  const tabs = isAdmin ? adminTabs : userTabs;

  const isActive = (href: string) => {
    if (href === "/admin") return location === "/admin";
    return location.startsWith(href);
  };

  return (
    <div className="flex flex-col h-screen min-h-safe bg-background text-foreground overflow-hidden relative">
      {/* Header */}
      {title && (
        <header className="flex-none pt-safe px-4 py-3 bg-card border-b border-border/50 z-10 shadow-sm">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative bg-background">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="flex-none bg-card border-t border-border/50 pb-safe z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
        <div className="flex px-1 py-2">
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-200",
                  active
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                <tab.icon className={cn("w-5 h-5 mb-1 transition-transform", active && "scale-110")} />
                <span className="text-[10px] font-medium leading-none">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
