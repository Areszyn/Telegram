import { useState } from "react";
import { createPortal } from "react-dom";
import { Message } from "@workspace/api-client-react";
import { FileIcon, Headphones, Video, X, ZoomIn, Check, CheckCheck, Copy } from "lucide-react";
import { formatTimeIST, formatDateIST } from "@/lib/date";
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
  isGrouped?: boolean;
  isLastInGroup?: boolean;
  showDate?: boolean;
}

export function MessageBubble({ message, isOwn, isGrouped = false, isLastInGroup = true, showDate }: MessageBubbleProps) {
  const time = formatTimeIST(message.created_at);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const url = resolveMediaUrl(message);

  const handleCopy = () => {
    if (message.text) {
      navigator.clipboard?.writeText(message.text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleLongPress = () => {
    setShowActions(true);
    setTimeout(() => setShowActions(false), 3000);
  };

  const renderMedia = () => {
    if (!url) return null;

    switch (message.media_type) {
      case "photo":
        return (
          <div className="relative group cursor-pointer mb-1.5" onClick={() => setLightboxSrc(url)}>
            <img
              src={url}
              alt="Shared photo"
              className="rounded-xl w-full max-w-[260px] h-auto object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 rounded-xl flex items-end justify-end p-2 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
              <div className="bg-black/50 backdrop-blur-sm rounded-full p-1.5">
                <ZoomIn className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          </div>
        );

      case "video":
        return (
          <div className="relative mb-1.5 w-full max-w-[260px]">
            <video
              src={url}
              controls
              playsInline
              preload="metadata"
              className="rounded-xl w-full bg-black/20"
            />
            <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-md rounded-full p-1.5 pointer-events-none">
              <Video className="w-4 h-4 text-white" />
            </div>
          </div>
        );

      case "voice":
      case "audio":
        return (
          <div className="flex items-center gap-3 bg-black/15 p-2.5 rounded-xl mb-1.5">
            <div className={cn(
              "rounded-full p-2 shrink-0",
              isOwn ? "bg-white/20" : "bg-indigo-500/20"
            )}>
              <Headphones className={cn("w-4 h-4", isOwn ? "text-white" : "text-indigo-400")} />
            </div>
            <audio src={url} controls className="h-8 min-w-0" style={{ maxWidth: 180 }} />
          </div>
        );

      case "document":
        return (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            download
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl mb-1.5 transition-colors",
              isOwn ? "bg-white/10 hover:bg-white/15" : "bg-black/10 hover:bg-black/15"
            )}
          >
            <div className={cn(
              "rounded-lg p-2 shrink-0",
              isOwn ? "bg-white/20" : "bg-blue-500/15"
            )}>
              <FileIcon className={cn("w-5 h-5", isOwn ? "text-white" : "text-blue-400")} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {message.text ? message.text.split("\n")[0].slice(0, 40) : "Document"}
              </p>
              <p className={cn("text-[11px]", isOwn ? "text-white/50" : "text-white/40")}>Tap to download</p>
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

      {showDate && (
        <div className="flex justify-center my-4">
          <span className="px-3 py-1 rounded-full bg-white/5 text-[11px] text-white/40 font-medium backdrop-blur-sm">
            {formatDateIST(message.created_at)}
          </span>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={cn(
          "flex w-full group",
          isOwn ? "justify-end" : "justify-start",
          isGrouped ? "mt-[3px]" : "mt-2.5"
        )}
        onContextMenu={(e) => { e.preventDefault(); handleLongPress(); }}
      >
        <div className={cn(
          "flex flex-col max-w-[72%]",
          isOwn ? "items-end" : "items-start"
        )}>
          {!isOwn && !isGrouped && (
            <div className="flex items-center gap-1.5 mb-1 ml-1">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-[9px] font-bold text-white">A</span>
              </div>
              <span className="text-[11px] font-semibold text-indigo-400">Admin</span>
            </div>
          )}

          <div className="relative">
            <div
              className={cn(
                "relative px-[14px] py-[10px] shadow-sm transition-shadow",
                isOwn
                  ? cn(
                      "bg-gradient-to-br from-indigo-600 to-indigo-700 text-white",
                      isGrouped && !isLastInGroup ? "rounded-2xl rounded-tr-md" :
                      isGrouped && isLastInGroup ? "rounded-2xl rounded-tr-md" :
                      !isGrouped && !isLastInGroup ? "rounded-2xl rounded-br-md" :
                      "rounded-2xl rounded-br-md"
                    )
                  : cn(
                      "bg-[#1c1c28] text-white/90 border border-white/[0.06]",
                      isGrouped && !isLastInGroup ? "rounded-2xl rounded-tl-md" :
                      isGrouped && isLastInGroup ? "rounded-2xl rounded-tl-md" :
                      !isGrouped && !isLastInGroup ? "rounded-2xl rounded-bl-md" :
                      "rounded-2xl rounded-bl-md"
                    ),
                "hover:shadow-md"
              )}
            >
              {renderMedia()}
              {message.text && message.media_type !== "document" && (
                <p className="text-[14.5px] leading-[1.55] break-words whitespace-pre-wrap" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
                  {message.text}
                </p>
              )}
              <div className={cn(
                "flex items-center gap-1 mt-1",
                isOwn ? "justify-end" : "justify-start",
                !message.text && !url && "hidden"
              )}>
                <span className={cn(
                  "text-[10px]",
                  isOwn ? "text-white/50" : "text-white/30"
                )}>
                  {time}
                </span>
                {isOwn && (
                  <CheckCheck className="w-3.5 h-3.5 text-white/40" />
                )}
              </div>
            </div>

            {showActions && message.text && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "absolute top-0 z-20 flex items-center gap-1 bg-[#1a1a26] border border-white/10 rounded-lg px-1 py-0.5 shadow-xl",
                  isOwn ? "right-full mr-1" : "left-full ml-1"
                )}
              >
                <button onClick={handleCopy}
                  className="p-1.5 rounded-md hover:bg-white/10 transition-colors">
                  {copied
                    ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                    : <Copy className="w-3.5 h-3.5 text-white/60" />}
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex justify-start mt-2"
    >
      <div className="flex items-center gap-2 ml-1">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <span className="text-[9px] font-bold text-white">A</span>
        </div>
        <div className="bg-[#1c1c28] border border-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3">
          <div className="flex gap-[5px]">
            <span className="w-[7px] h-[7px] bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1.2s" }} />
            <span className="w-[7px] h-[7px] bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "200ms", animationDuration: "1.2s" }} />
            <span className="w-[7px] h-[7px] bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "400ms", animationDuration: "1.2s" }} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
