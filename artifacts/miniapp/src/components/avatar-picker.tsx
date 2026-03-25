import { useState } from "react";
import { AVATARS } from "@/lib/avatars";
import { NotionAvatar } from "@/components/notion-avatar";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  current: number | null;
  onSelect: (id: number) => void;
  onClose: () => void;
  loading?: boolean;
};

export function AvatarPicker({ current, onSelect, onClose, loading }: Props) {
  const [selected, setSelected] = useState<number | null>(current);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-background rounded-t-2xl border-t border-border animate-in slide-in-from-bottom duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Choose Your Avatar</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3 grid grid-cols-5 gap-2 max-h-[50vh] overflow-y-auto">
          {AVATARS.map(av => (
            <button
              key={av.id}
              onClick={() => setSelected(av.id)}
              className={cn(
                "flex items-center justify-center p-1.5 rounded-xl transition-all",
                selected === av.id
                  ? "bg-primary/15 ring-2 ring-primary scale-105"
                  : "hover:bg-muted/60",
              )}
            >
              <NotionAvatar avatarId={av.id} size={48} />
            </button>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-border flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-9 rounded-xl border border-border text-xs font-medium hover:bg-muted/60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => selected && onSelect(selected)}
            disabled={!selected || selected === current || loading}
            className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40 transition-colors"
          >
            {loading ? "Saving..." : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
