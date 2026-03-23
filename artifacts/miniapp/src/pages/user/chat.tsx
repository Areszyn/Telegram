import { useEffect, useRef, useCallback } from "react";
import { useGetMyMessages, useSendMessage, getGetMyMessagesQueryKey } from "@workspace/api-client-react";
import { useApiAuth } from "@/lib/telegram-context";
import { Layout } from "@/components/layout";
import { MessageBubble } from "@/components/message-bubble";
import { ChatInput } from "@/components/chat-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle, CreditCard } from "lucide-react";
import { Link } from "wouter";

export function UserChat() {
  const reqOpts = useApiAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const optimisticIdRef = useRef(0);

  const { data: messages, isLoading } = useGetMyMessages({
    request: reqOpts,
    query: { queryKey: getGetMyMessagesQueryKey(), refetchInterval: 1500, staleTime: 0 },
  });

  const sendMut = useSendMessage({
    request: reqOpts,
    mutation: {
      onMutate: async (vars: { data?: { text?: string } }) => {
        await queryClient.cancelQueries({ queryKey: getGetMyMessagesQueryKey() });
        const prev = queryClient.getQueryData(getGetMyMessagesQueryKey());
        const tempId = `opt-${++optimisticIdRef.current}`;
        queryClient.setQueryData(getGetMyMessagesQueryKey(), (old: unknown) => [
          ...(Array.isArray(old) ? old : []),
          {
            id: tempId,
            text: vars.data?.text ?? null,
            sender_type: "user",
            created_at: new Date().toISOString(),
            media_type: "text",
            media_url: null,
            telegram_file_id: null,
          },
        ]);
        return { prev };
      },
      onError: (_err: unknown, _vars: unknown, ctx: { prev: unknown } | undefined) => {
        if (ctx?.prev !== undefined) {
          queryClient.setQueryData(getGetMyMessagesQueryKey(), ctx.prev);
        }
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetMyMessagesQueryKey() }),
    },
  });

  const scrollToBottom = useCallback((instant?: boolean) => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: instant ? "auto" : "smooth" });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <Layout title="Support Chat">
      <div className="flex flex-col h-full bg-background">

        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-muted/20 flex-none">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <p className="text-[11px] text-muted-foreground">Messages are forwarded to admin in real-time</p>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-2"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {isLoading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                  <Skeleton className={`h-10 rounded-2xl ${i % 2 === 0 ? "w-44" : "w-56"}`} />
                </div>
              ))}
            </div>
          ) : messages?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <MessageCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold">No messages yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-[220px]">
                  Send a message below and the admin will reply shortly.
                </p>
              </div>
              <Link href="/donate">
                <span className="flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-400/40 bg-amber-400/10 text-amber-600 text-sm font-medium active:bg-amber-400/20 transition-colors cursor-pointer">
                  <CreditCard className="h-4 w-4" />
                  Make a Donation
                </span>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col justify-end min-h-full">
              {messages?.map(msg => (
                <MessageBubble key={msg.id} message={msg} isOwn={msg.sender_type === "user"} />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <ChatInput
          onSend={text => {
            sendMut.mutate({ data: { text } });
            scrollToBottom(true);
          }}
          isLoading={sendMut.isPending}
          showLocation
          onMediaSent={() => {
            queryClient.invalidateQueries({ queryKey: getGetMyMessagesQueryKey() });
            scrollToBottom(true);
          }}
        />
      </div>
    </Layout>
  );
}
