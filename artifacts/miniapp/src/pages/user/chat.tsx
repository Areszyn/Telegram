import { useEffect, useRef, useCallback, useMemo } from "react";
import { useGetMyMessages, useSendMessage, getGetMyMessagesQueryKey } from "@workspace/api-client-react";
import { useApiAuth } from "@/lib/telegram-context";
import { Layout } from "@/components/layout";
import { MessageBubble } from "@/components/message-bubble";
import { ChatInput } from "@/components/chat-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle, CreditCard, Shield } from "lucide-react";
import { Link } from "wouter";

function isSameDay(d1: string, d2: string) {
  return d1.slice(0, 10) === d2.slice(0, 10);
}

export function UserChat() {
  const reqOpts = useApiAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
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
    if (!isAtBottomRef.current && !instant) return;
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: instant ? "auto" : "smooth" });
    });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 80;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const groupedMessages = useMemo(() => {
    if (!messages) return [] as { msg: typeof messages[0]; isGrouped: boolean; isLastInGroup: boolean; showDate: boolean }[];
    return messages.map((msg: typeof messages[0], i: number) => {
      const prev = i > 0 ? messages[i - 1] : null;
      const next = i < messages.length - 1 ? messages[i + 1] : null;
      const isGrouped = prev?.sender_type === msg.sender_type
        && prev?.created_at && msg.created_at
        && Math.abs(new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()) < 120000;
      const isLastInGroup = !next || next.sender_type !== msg.sender_type
        || Math.abs(new Date(next.created_at).getTime() - new Date(msg.created_at).getTime()) >= 120000;
      const showDate = !prev || !isSameDay(prev.created_at, msg.created_at);
      return { msg, isGrouped, isLastInGroup, showDate };
    });
  }, [messages]);

  return (
    <Layout title="Support Chat">
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-[#0c0c14]/60 backdrop-blur-sm flex-none">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white/90">Support</p>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <p className="text-[10px] text-emerald-400/80">Online</p>
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overscroll-contain px-3 pt-3 pb-2"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {isLoading ? (
            <div className="flex flex-col gap-3 pt-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                  <Skeleton className={`h-10 rounded-2xl ${i % 2 === 0 ? "w-40" : "w-52"}`} />
                </div>
              ))}
            </div>
          ) : messages?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-5 py-12">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/20 flex items-center justify-center">
                <MessageCircle className="h-10 w-10 text-indigo-400" />
              </div>
              <div>
                <p className="font-semibold text-white/90 text-base">Start a conversation</p>
                <p className="text-sm text-white/40 mt-2 max-w-[240px] leading-relaxed">
                  Send a message and the admin will reply shortly. Messages are forwarded in real-time.
                </p>
              </div>
              <Link href="/donate">
                <span className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-500 text-sm font-medium active:bg-amber-400/20 transition-colors cursor-pointer">
                  <CreditCard className="h-4 w-4" />
                  Make a Donation
                </span>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col justify-end min-h-full">
              {groupedMessages.map(({ msg, isGrouped, isLastInGroup, showDate }: { msg: any; isGrouped: boolean; isLastInGroup: boolean; showDate: boolean }) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.sender_type === "user"}
                  isGrouped={isGrouped}
                  isLastInGroup={isLastInGroup}
                  showDate={showDate}
                />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <ChatInput
          onSend={text => {
            sendMut.mutate({ data: { text } });
            isAtBottomRef.current = true;
            scrollToBottom(true);
          }}
          isLoading={sendMut.isPending}
          showLocation
          onMediaSent={() => {
            queryClient.invalidateQueries({ queryKey: getGetMyMessagesQueryKey() });
            isAtBottomRef.current = true;
            scrollToBottom(true);
          }}
        />
      </div>
    </Layout>
  );
}
