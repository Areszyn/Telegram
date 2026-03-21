import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "./StatusBadge";
import { format } from "date-fns";

export type AdminDonation = {
  id: number;
  amount: number;
  currency: string;
  status: string;
  track_id: string;
  tx_id?: string;
  created_at: string;
  first_name: string;
  username?: string;
  telegram_id: string;
};

const avatarColors = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500",
  "bg-orange-500", "bg-pink-500", "bg-cyan-500",
];
function avatarColor(name?: string) {
  return avatarColors[(name?.charCodeAt(0) ?? 0) % avatarColors.length];
}
function getInitials(name?: string) {
  return name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{children}</span>
    </div>
  );
}

interface AdminPaymentDialogProps {
  donation: AdminDonation | null;
  open: boolean;
  onClose: () => void;
}

export function AdminPaymentDialog({ donation, open, onClose }: AdminPaymentDialogProps) {
  if (!donation) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <Avatar className={`h-10 w-10 shrink-0 ${avatarColor(donation.first_name)}`}>
              <AvatarFallback className={`text-white font-semibold text-sm ${avatarColor(donation.first_name)}`}>
                {getInitials(donation.first_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <DialogTitle className="text-base leading-tight truncate">{donation.first_name}</DialogTitle>
              <DialogDescription className="text-xs">
                {donation.username ? `@${donation.username}` : `ID: ${donation.telegram_id}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        <div className="divide-y divide-border">
          <Row label="Amount">
            <span className="font-semibold">${donation.amount?.toFixed(2)}</span>
            <span className="text-muted-foreground font-normal ml-1">{donation.currency}</span>
          </Row>
          <Row label="Status">
            <StatusBadge status={donation.status} />
          </Row>
          <Row label="Date">
            {format(new Date(donation.created_at), "MMM d, yyyy · HH:mm")}
          </Row>
          {donation.track_id && (
            <Row label="Track ID">
              <span className="font-mono text-xs text-muted-foreground break-all text-right">
                {donation.track_id}
              </span>
            </Row>
          )}
          {donation.tx_id && (
            <Row label="TX Hash">
              <span className="font-mono text-xs text-muted-foreground break-all text-right">
                {donation.tx_id}
              </span>
            </Row>
          )}
          <Row label="Telegram ID">
            <span className="font-mono text-xs text-muted-foreground">{donation.telegram_id}</span>
          </Row>
        </div>
      </DialogContent>
    </Dialog>
  );
}
