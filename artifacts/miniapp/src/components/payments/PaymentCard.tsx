import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { RefreshCw, ExternalLink } from "lucide-react";
import { formatDateTimeIST } from "@/lib/date";
import { cn } from "@/lib/utils";

export type Payment = {
  id: number;
  amount: number;
  currency: string;
  status: string;
  track_id: string;
  pay_link?: string;
  tx_id?: string;
  created_at: string;
};

interface PaymentCardProps {
  payment: Payment;
  onVerify?: (trackId: string) => void;
  onOpenPayLink?: (payLink: string, trackId: string) => void;
  verifying?: boolean;
  onClick?: () => void;
}

export function PaymentCard({ payment, onVerify, onOpenPayLink, verifying, onClick }: PaymentCardProps) {
  const isPending = payment.status === "pending";

  return (
    <Card
      className={cn(
        "transition-colors",
        onClick && "cursor-pointer hover:bg-muted/40 active:bg-muted/60"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight">
              ${payment.amount?.toFixed(2)}
              <span className="text-muted-foreground font-normal text-xs ml-1.5">{payment.currency}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDateTimeIST(payment.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isPending && onVerify && payment.track_id && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={e => { e.stopPropagation(); onVerify(payment.track_id); }}
                disabled={verifying}
                title="Check status"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", verifying && "animate-spin")} />
              </Button>
            )}
            {isPending && payment.pay_link && onOpenPayLink && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 px-2.5"
                onClick={e => { e.stopPropagation(); onOpenPayLink(payment.pay_link!, payment.track_id); }}
              >
                <ExternalLink className="h-3 w-3" />
                Pay
              </Button>
            )}
            <StatusBadge status={payment.status} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
