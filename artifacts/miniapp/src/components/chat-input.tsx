import { useState, useRef, useEffect } from "react";
import { SendHorizontal } from "lucide-react";

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
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [text]);

  return (
    <div className="p-3 bg-card border-t border-border/50 shadow-[0_-10px_20px_rgba(0,0,0,0.1)]">
      <div className="flex items-end gap-2 bg-background border border-border/80 rounded-2xl p-1.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          disabled={isLoading}
          className="flex-1 max-h-[120px] bg-transparent border-0 focus:ring-0 resize-none py-2 px-3 text-[15px] text-foreground placeholder:text-muted-foreground min-h-[44px] outline-none"
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || isLoading}
          className="shrink-0 p-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground hover:bg-primary/90 transition-colors mb-0.5 mr-0.5"
        >
          <SendHorizontal className="w-5 h-5 ml-0.5" />
        </button>
      </div>
    </div>
  );
}
