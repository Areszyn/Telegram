import { Message } from "@workspace/api-client-react";
import { format } from "date-fns";
import { FileIcon, Headphones, Video } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { motion } from "framer-motion";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const time = format(new Date(message.created_at), "HH:mm");

  const renderMedia = () => {
    if (!message.media_url) return null;

    switch (message.media_type) {
      case "photo":
        return (
          <img 
            src={message.media_url} 
            alt="Shared photo" 
            className="rounded-lg w-full max-w-[240px] h-auto object-cover mb-2 border border-white/10" 
            loading="lazy"
          />
        );
      case "video":
        return (
          <div className="relative mb-2 w-full max-w-[240px]">
            <video 
              src={message.media_url} 
              controls 
              className="rounded-lg w-full bg-black/20 border border-white/10" 
            />
            <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-md rounded-full p-1.5">
              <Video className="w-4 h-4 text-white" />
            </div>
          </div>
        );
      case "voice":
      case "audio":
        return (
          <div className="flex items-center gap-3 bg-black/20 p-2 rounded-lg mb-2">
            <div className="bg-primary text-primary-foreground rounded-full p-2">
              <Headphones className="w-5 h-5" />
            </div>
            <audio src={message.media_url} controls className="h-8 max-w-[180px]" />
          </div>
        );
      case "document":
        return (
          <a 
            href={message.media_url} 
            target="_blank" 
            rel="noreferrer" 
            className="flex items-center gap-3 bg-black/20 hover:bg-black/30 transition-colors p-3 rounded-lg mb-2 border border-white/5"
          >
            <div className="bg-blue-500/20 text-blue-400 rounded-lg p-2">
              <FileIcon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Document</p>
              <p className="text-xs text-white/50">Click to view</p>
            </div>
          </a>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        "flex w-full mb-4",
        isOwn ? "justify-end" : "justify-start"
      )}
    >
      <div 
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 relative shadow-sm",
          isOwn 
            ? "bg-primary text-primary-foreground rounded-br-sm" 
            : "bg-card text-card-foreground rounded-bl-sm border border-border/50"
        )}
      >
        {renderMedia()}
        {message.text && (
          <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
            {message.text}
          </p>
        )}
        <div 
          className={cn(
            "text-[10px] text-right mt-1 opacity-70",
            !message.text && !message.media_url && "hidden"
          )}
        >
          {time}
        </div>
      </div>
    </motion.div>
  );
}
