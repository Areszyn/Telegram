import { useState } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { useBroadcastMessage } from "@workspace/api-client-react";
import { Radio, Send, Loader2, CheckCircle2 } from "lucide-react";

export function AdminBroadcast() {
  const reqOpts = useApiAuth();
  const [text, setText] = useState("");
  const [result, setResult] = useState<{sent: number, total: number} | null>(null);

  const broadcastMut = useBroadcastMessage({
    request: reqOpts,
    mutation: {
      onSuccess: (res) => {
        setResult({ sent: res.sent, total: res.total });
        setText("");
      }
    }
  });

  const handleSend = () => {
    if (!text.trim()) return;
    setResult(null);
    broadcastMut.mutate({ data: { text: text.trim() } });
  };

  return (
    <Layout title="Broadcast">
      <div className="p-4 h-full overflow-y-auto">
        
        <div className="bg-gradient-to-br from-primary/20 to-transparent border border-primary/20 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary text-primary-foreground p-2 rounded-lg shadow-lg">
              <Radio className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Mass Broadcast</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Send a message to all users who have interacted with the bot. Use this for announcements or updates.
          </p>
        </div>

        <div className="space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your message here..."
            className="w-full bg-card border border-border/50 rounded-2xl p-4 text-[15px] min-h-[160px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none shadow-sm"
          />
          
          <button
            onClick={handleSend}
            disabled={!text.trim() || broadcastMut.isPending}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-2"
          >
            {broadcastMut.isPending ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Sending...</>
            ) : (
              <><Send className="w-5 h-5" /> Send Broadcast</>
            )}
          </button>
        </div>

        {result && (
          <div className="mt-6 bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-green-500">Broadcast Complete</h4>
              <p className="text-sm text-green-500/80 mt-1">
                Successfully sent to {result.sent} out of {result.total} registered users.
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
