import { useState } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { useBroadcastMessage } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Radio, Send } from "lucide-react";
import { toast } from "sonner";

export function AdminBroadcast() {
  const reqOpts = useApiAuth();
  const [text, setText] = useState("");

  const broadcastMut = useBroadcastMessage({
    request: reqOpts,
    mutation: {
      onSuccess: (res: { sent: number; total: number }) => {
        toast.success(`Broadcast sent to ${res.sent} of ${res.total} users`);
        setText("");
      },
      onError: () => {
        toast.error("Failed to send broadcast");
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

          <Separator />

          <CardContent className="pt-4 space-y-3">
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Type your announcement here…"
              className="min-h-[160px] resize-none text-[15px]"
            />
            <p className="text-xs text-muted-foreground text-right">{text.length} characters</p>
            <Button
              onClick={() => broadcastMut.mutate({ data: { text: text.trim() } })}
              disabled={!text.trim() || broadcastMut.isPending}
              className="w-full"
              size="lg"
            >
              {broadcastMut.isPending
                ? <><Send className="h-4 w-4 animate-pulse" /> Sending…</>
                : <><Send className="h-4 w-4" /> Send to All Users</>
              }
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
