import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PaymentStatus = "pending" | "paid" | "confirming" | "expired" | "failed";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  paid:       { label: "Paid",        cls: "border-white/15 bg-white/5 text-white/60" },
  confirming: { label: "Confirming",  cls: "border-white/10 bg-white/5 text-white/40" },
  expired:    { label: "Expired",     cls: "border-white/10 bg-white/5 text-white/30" },
  failed:     { label: "Failed",      cls: "border-white/10 bg-white/5 text-white/30" },
  pending:    { label: "Pending",     cls: "border-white/10 bg-white/5 text-white/40" },
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
