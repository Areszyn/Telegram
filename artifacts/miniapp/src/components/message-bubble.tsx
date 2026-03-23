import { useState } from "react";
import { createPortal } from "react-dom";
import { Message } from "@workspace/api-client-react";
import { FileIcon, Headphones, Video, X, ZoomIn } from "lucide-react";
import { formatTimeIST } from "@/lib/date";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { motion } from "framer-motion";
import { API_BASE } from "@/lib/api";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function resolveMediaUrl(message: Message): string | null {
  if (message.media_url) return message.media_url;
  if (message.telegram_file_id) return `${API_BASE}/file/${message.telegram_file_id}`;
  return null;
}

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 rounded-full p-2 z-10"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt="Full size"
        className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const time = formatTimeIST(message.created_at);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const url = resolveMediaUrl(message);

  const renderMedia = () => {
    if (!url) return null;

    switch (message.media_type) {
      case "photo":
        return (
          <div className="relative group cursor-pointer mb-2" onClick={() => setLightboxSrc(url)}>
            <img
              src={url}
              alt="Shared photo"
              className="rounded-lg w-full max-w-[260px] h-auto object-cover border border-white/10"
              loading="lazy"
            />
            <div className="absolute inset-0 rounded-lg flex items-end justify-end p-2 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
              <div className="bg-black/50 backdrop-blur-sm rounded-full p-1">
                <ZoomIn className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>
        );

      case "video":
        return (
          <div className="relative mb-2 w-full max-w-[260px]">
            <video
              src={url}
              controls
              playsInline
              preload="metadata"
              className="rounded-lg w-full bg-black/20 border border-white/10"
            />
            <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-md rounded-full p-1.5 pointer-events-none">
              <Video className="w-4 h-4 text-white" />
            </div>
          </div>
        );

      case "voice":
      case "audio":
        return (
          <div className="flex items-center gap-3 bg-black/20 p-2 rounded-lg mb-2">
            <div className="bg-primary text-primary-foreground rounded-full p-2 shrink-0">
              <Headphones className="w-5 h-5" />
            </div>
            <audio
              src={url}
              controls
              className="h-8 min-w-0"
              style={{ maxWidth: 180 }}
            />
          </div>
        );

      case "document":
        return (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            download
            className="flex items-center gap-3 bg-black/20 hover:bg-black/30 transition-colors p-3 rounded-lg mb-2 border border-white/5"
          >
            <div className="bg-blue-500/20 text-blue-400 rounded-lg p-2 shrink-0">
              <FileIcon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {message.text ? message.text.split("\n")[0].slice(0, 40) : "Document"}
              </p>
              <p className="text-xs text-white/50">Tap to open</p>
            </div>
          </a>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.12 }}
        className={cn("flex w-full mb-2.5", isOwn ? "justify-end" : "justify-start")}
      >
        <div className={cn("flex flex-col gap-0.5 max-w-[85%]", isOwn ? "items-end" : "items-start")}>
          {!isOwn && (
            <span className="text-[10px] font-semibold text-primary px-1 ml-1">Admin</span>
          )}

          <div
            className={cn(
              "rounded-2xl px-4 py-2.5 relative shadow-sm",
              isOwn
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-card text-card-foreground rounded-bl-sm border border-border/50"
            )}
          >
            {renderMedia()}
            {message.text && message.media_type !== "document" && (
              <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                {message.text}
              </p>
            )}
            <div
              className={cn(
                "text-[10px] text-right mt-0.5 opacity-60",
                !message.text && !url && "hidden",
                isOwn ? "text-primary-foreground/60" : "text-muted-foreground"
              )}
            >
              {time}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
