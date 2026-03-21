import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading?: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (text.trim() && !isLoading) {
      onSend(text.trim());
      setText("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [text]);

  return (
    <div className="p-3 bg-card border-t border-border">
      <div className={cn(
        "flex items-end gap-2 rounded-xl border bg-background px-3 py-2 transition-shadow",
        "focus-within:ring-1 focus-within:ring-ring"
      )}>
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          disabled={isLoading}
          rows={1}
          className="flex-1 max-h-[120px] min-h-[36px] resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-[15px] placeholder:text-muted-foreground"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!text.trim() || isLoading}
          className="mb-0.5 shrink-0 h-8 w-8 rounded-lg"
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
