import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

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
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.blur();
      }
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
    <div className="flex-none p-3 bg-card border-t border-border space-y-2">
      <div className={cn(
        "flex items-end gap-2 rounded-xl border bg-background px-3 py-2 transition-shadow",
        "focus-within:ring-1 focus-within:ring-ring"
      )}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          disabled={isLoading}
          rows={1}
          autoComplete="off"
          autoCorrect="on"
          enterKeyHint="send"
          className="flex-1 max-h-[120px] min-h-[36px] resize-none border-0 bg-transparent p-0 shadow-none focus:outline-none focus:ring-0 text-[16px] leading-[1.5] placeholder:text-muted-foreground text-foreground"
          style={{ fontSize: "16px" }}
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

      <div className="flex items-center justify-between px-0.5">
        <p className="text-[10px] text-muted-foreground/60">
          Enter to send
        </p>
        <Link href="/donate">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-500 active:text-amber-400 transition-colors cursor-pointer">
            <span>&#11088;</span>
            Donate
          </span>
        </Link>
      </div>
    </div>
  );
}
