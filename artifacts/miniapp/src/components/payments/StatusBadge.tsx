import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PaymentStatus = "pending" | "paid" | "confirming" | "expired" | "failed";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  paid:       { label: "Paid",        cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  confirming: { label: "Confirming",  cls: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  expired:    { label: "Expired",     cls: "border-zinc-400/40 bg-zinc-500/10 text-zinc-500" },
  failed:     { label: "Failed",      cls: "border-red-500/40 bg-red-500/10 text-red-500" },
  pending:    { label: "Pending",     cls: "border-yellow-500/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <Badge variant="outline" className={cn(config.cls, "font-medium text-[11px] px-2 py-0.5", className)}>
      {config.label}
    </Badge>
  );
}
