import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "./StatusBadge";
import { Copy, Check, ExternalLink, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export type PaymentDetail = {
  id: number;
  amount: number;
  currency: string;
  status: string;
  track_id: string;
  pay_link?: string;
  tx_id?: string;
  created_at: string;
};

interface PaymentDialogProps {
  payment: PaymentDetail | null;
  open: boolean;
  onClose: () => void;
  onVerify?: (trackId: string) => void;
  onOpen?: (payLink: string, trackId: string) => void;
  verifying?: boolean;
}

function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="ml-1 inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{children}</span>
    </div>
  );
}

export function PaymentDialog({ payment, open, onClose, onVerify, onOpen, verifying }: PaymentDialogProps) {
  if (!payment) return null;

  const isPending = payment.status === "pending" || payment.status === "confirming";

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Payment Details</DialogTitle>
          <DialogDescription>
            Invoice #{payment.id}
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-border">
          <Row label="Amount">
            <span className="font-semibold">${payment.amount?.toFixed(2)}</span>
            <span className="text-muted-foreground font-normal ml-1">{payment.currency}</span>
          </Row>
          <Row label="Status">
            <StatusBadge status={payment.status} />
          </Row>
          <Row label="Created">
            {format(new Date(payment.created_at), "MMM d, yyyy · HH:mm")}
          </Row>
          {payment.track_id && (
            <Row label="Track ID">
              <span className="font-mono text-xs text-muted-foreground">
                {payment.track_id.slice(0, 20)}…
                <CopyText text={payment.track_id} />
              </span>
            </Row>
          )}
          {payment.tx_id && (
            <Row label="Transaction">
              <span className="font-mono text-xs text-muted-foreground">
                {payment.tx_id.slice(0, 16)}…
                <CopyText text={payment.tx_id} />
              </span>
            </Row>
          )}
        </div>

        {isPending && (payment.pay_link || onVerify) && (
          <>
            <Separator />
            <div className="flex gap-2 pt-1">
              {payment.pay_link && onOpen && (
                <Button
                  className="flex-1"
                  onClick={() => { onOpen(payment.pay_link!, payment.track_id); onClose(); }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Payment
                </Button>
              )}
              {onVerify && payment.track_id && (
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={verifying}
                  onClick={() => { onVerify(payment.track_id); onClose(); }}
                >
                  <RefreshCw className={`h-4 w-4 ${verifying ? "animate-spin" : ""}`} />
                  Check Status
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
