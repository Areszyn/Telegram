import { useEffect, useRef } from "react";
import { useGetMyMessages, useSendMessage, getGetMyMessagesQueryKey } from "@workspace/api-client-react";
import { useApiAuth } from "@/lib/telegram-context";
import { Layout } from "@/components/layout";
import { MessageBubble } from "@/components/message-bubble";
import { ChatInput } from "@/components/chat-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";

export function UserChat() {
  const reqOpts = useApiAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useGetMyMessages({
    request: reqOpts,
    query: { refetchInterval: 3000 },
  });

  const sendMut = useSendMessage({
    request: reqOpts,
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetMyMessagesQueryKey() }),
    },
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  return (
    <Layout title="Support Chat">
      <div className="flex flex-col h-full bg-background">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                  <Skeleton className={`h-10 rounded-2xl ${i % 2 === 0 ? "w-44" : "w-56"}`} />
                </div>
              ))}
            </div>
          ) : messages?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <MessageCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold">No messages yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-[220px]">
                  Send a message below and the admin will reply shortly.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-end min-h-full">
              {messages?.map(msg => (
                <MessageBubble key={msg.id} message={msg} isOwn={msg.sender_type === "user"} />
              ))}
            </div>
          )}
        </div>
        <ChatInput onSend={text => sendMut.mutate({ data: { text } })} isLoading={sendMut.isPending} />
      </div>
    </Layout>
  );
}
