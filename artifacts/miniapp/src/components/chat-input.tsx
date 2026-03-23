import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { SendHorizontal, MapPin, Loader2, Paperclip, Mic, X, Image, Video, FileText, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { API_BASE } from "@/lib/api";
import { useApiAuth } from "@/lib/telegram-context";
import { toast } from "sonner";

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading?: boolean;
  showLocation?: boolean;
  onLocation?: (lat: number, lng: number) => void;
  onMediaSent?: () => void;
  targetUserId?: number;
}

type MediaType = "photo" | "video" | "audio" | "voice" | "document";

function detectMediaType(file: File): MediaType {
  if (file.type.startsWith("image/")) return "photo";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "document";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MEDIA_ICON: Record<MediaType, typeof Image> = {
  photo: Image,
  video: Video,
  audio: Music,
  voice: Mic,
  document: FileText,
};

export function ChatInput({ onSend, isLoading, showLocation, onLocation, onMediaSent, targetUserId }: ChatInputProps) {
  const [text, setText] = useState("");
  const [locLoading, setLocLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { headers } = useApiAuth() as { headers: Record<string, string> };

  const handleSend = () => {
    if (selectedFile) {
      handleUpload();
      return;
    }
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

  const handleLocation = () => {
    if (!navigator.geolocation || locLoading) return;
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocLoading(false);
        const { latitude, longitude } = pos.coords;
        if (onLocation) {
          onLocation(latitude, longitude);
        } else {
          const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
          onSend(`📍 My location: ${mapsUrl}`);
        }
      },
      () => { setLocLoading(false); toast.error("Location access denied"); },
      { timeout: 10000 },
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large. Max 20 MB.");
      return;
    }
    setSelectedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = useCallback(async () => {
    if (!selectedFile || uploading) return;
    setUploading(true);
    const mediaType = detectMediaType(selectedFile);
    const tid = toast.loading(`Sending ${mediaType}...`);
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      form.append("media_type", mediaType);
      if (text.trim()) form.append("caption", text.trim());
      if (targetUserId) form.append("target_user_id", String(targetUserId));

      const res = await fetch(`${API_BASE}/send-media`, {
        method: "POST",
        headers,
        body: form,
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Sent!", { id: tid });
        setSelectedFile(null);
        setText("");
        onMediaSent?.();
      } else {
        toast.error(data.error ?? "Failed to send", { id: tid });
      }
    } catch {
      toast.error("Network error", { id: tid });
    } finally {
      setUploading(false);
    }
  }, [selectedFile, text, headers, uploading, onMediaSent, targetUserId]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus") ? "audio/ogg;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
        : "audio/webm";
      const ext = mimeType.startsWith("audio/ogg") ? "ogg" : "webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], `voice.${ext}`, { type: mimeType });
        sendVoice(file);
      };
      recorder.start(100);
      recorderRef.current = recorder;
      setRecording(true);
      setRecordTime(0);
      timerRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cancelRecording = () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.ondataavailable = null;
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
      recorderRef.current.stream?.getTracks().forEach(t => t.stop());
    }
    chunksRef.current = [];
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const sendVoice = async (file: File) => {
    setUploading(true);
    const tid = toast.loading("Sending voice...");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("media_type", "voice");
      if (targetUserId) form.append("target_user_id", String(targetUserId));

      const res = await fetch(`${API_BASE}/send-media`, {
        method: "POST",
        headers,
        body: form,
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Voice sent!", { id: tid });
        onMediaSent?.();
      } else {
        toast.error(data.error ?? "Failed", { id: tid });
      }
    } catch {
      toast.error("Network error", { id: tid });
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [text]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const FileIcon = selectedFile ? MEDIA_ICON[detectMediaType(selectedFile)] : FileText;

  return (
    <div className="flex-none bg-card border-t border-border">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar"
        onChange={handleFileSelect}
        className="hidden"
      />

      {selectedFile && (
        <div className="px-3 pt-2 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 min-w-0">
            <FileIcon className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{selectedFile.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatFileSize(selectedFile.size)} · {detectMediaType(selectedFile)}
              </p>
            </div>
            <button onClick={() => setSelectedFile(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {recording && (
        <div className="px-3 pt-2 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-3 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-xs font-mono text-red-600 dark:text-red-400">{formatTime(recordTime)}</span>
            <span className="text-xs text-red-500/70 flex-1">Recording...</span>
            <button onClick={cancelRecording} className="text-red-400 hover:text-red-600 mr-1">
              <X className="h-4 w-4" />
            </button>
            <Button size="icon" onClick={stopRecording} className="h-7 w-7 rounded-lg bg-red-500 hover:bg-red-600">
              <SendHorizontal className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <div className="p-3 space-y-2">
        {!recording && (
          <div className={cn(
            "flex items-end gap-2 rounded-xl border bg-background px-3 py-2 transition-shadow",
            "focus-within:ring-1 focus-within:ring-ring"
          )}>
            {showLocation && (
              <button
                type="button"
                onClick={handleLocation}
                disabled={locLoading || isLoading || uploading}
                className="mb-0.5 shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
                title="Share location"
              >
                {locLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <MapPin className="h-4 w-4" />
                }
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || uploading || recording}
              className="mb-0.5 shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedFile ? "Add caption..." : "Message..."}
              disabled={isLoading || uploading}
              rows={1}
              autoComplete="off"
              autoCorrect="on"
              enterKeyHint="send"
              className="flex-1 max-h-[120px] min-h-[36px] resize-none border-0 bg-transparent p-0 shadow-none focus:outline-none focus:ring-0 text-[16px] leading-[1.5] placeholder:text-muted-foreground text-foreground"
              style={{ fontSize: "16px" }}
            />
            {(text.trim() || selectedFile) ? (
              <Button
                size="icon"
                onClick={handleSend}
                disabled={uploading || isLoading}
                className="mb-0.5 shrink-0 h-8 w-8 rounded-lg"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
              </Button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={isLoading || uploading}
                className="mb-0.5 shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                title="Record voice"
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

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
    </div>
  );
}
