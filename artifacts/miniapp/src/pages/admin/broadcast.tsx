import { useState } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { useBroadcastMessage } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Radio, Send, CheckCircle2 } from "lucide-react";

export function AdminBroadcast() {
  const reqOpts = useApiAuth();
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ sent: number; total: number } | null>(null);

  const broadcastMut = useBroadcastMessage({
    request: reqOpts,
    mutation: {
      onSuccess: (res) => {
        setResult({ sent: res.sent, total: res.total });
        setText("");
      },
    },
  });

  return (
    <Layout title="Broadcast">
      <div className="h-full overflow-y-auto p-4 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Radio className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Mass Broadcast</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Send a message to all users who have interacted with the bot.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Type your announcement here…"
              className="min-h-[160px] resize-none text-[15px]"
            />
            <Button
              onClick={() => { setResult(null); broadcastMut.mutate({ data: { text: text.trim() } }); }}
              disabled={!text.trim() || broadcastMut.isPending}
              className="w-full"
            >
              {broadcastMut.isPending ? (
                "Sending…"
              ) : (
                <><Send className="h-4 w-4" /> Send Broadcast</>
              )}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="flex items-start gap-3 p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-600 text-sm">Broadcast sent</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Delivered to {result.sent} of {result.total} users.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
