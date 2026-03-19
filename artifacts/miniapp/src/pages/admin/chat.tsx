import { useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useGetMessages, useSendMessage, getGetMessagesQueryKey } from "@workspace/api-client-react";
import { useApiAuth } from "@/lib/telegram-context";
import { MessageBubble } from "@/components/message-bubble";
import { ChatInput } from "@/components/chat-input";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ChevronLeft } from "lucide-react";

export function AdminChat() {
  const [, params] = useRoute("/admin/chat/:userId");
  const userId = params?.userId;
  
  const reqOpts = useApiAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useGetMessages(userId || "", {
    request: reqOpts,
    query: { 
      enabled: !!userId,
      refetchInterval: 3000 
    }
  });

  const sendMut = useSendMessage({
    request: reqOpts,
    mutation: {
      onSuccess: () => {
        if (userId) {
          queryClient.invalidateQueries({ queryKey: getGetMessagesQueryKey(userId) });
        }
      }
    }
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (text: string) => {
    if (!userId) return;
    sendMut.mutate({ 
      data: { 
        text, 
        targetUserId: parseInt(userId, 10) 
      } 
    });
  };

  if (!userId) return null;

  return (
    <div className="flex flex-col h-screen min-h-safe bg-background text-foreground overflow-hidden">
      {/* Custom Admin Header */}
      <header className="flex-none pt-safe px-2 py-2 bg-card border-b border-border/50 z-10 shadow-sm flex items-center">
        <Link href="/admin" className="p-2 hover:bg-white/5 rounded-full mr-1 transition-colors">
          <ChevronLeft className="w-6 h-6 text-primary" />
        </Link>
        <div className="flex flex-col">
          <h1 className="text-[17px] font-semibold leading-tight">Chat #{userId}</h1>
          <span className="text-[12px] text-muted-foreground">Admin view</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 scroll-smooth" ref={scrollRef}>
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col justify-end min-h-full">
            {messages?.map((msg) => (
              <MessageBubble 
                key={msg.id} 
                message={msg} 
                isOwn={msg.sender_type === "admin"} 
              />
            ))}
            {messages?.length === 0 && (
              <div className="text-center text-muted-foreground my-auto">
                No messages found.
              </div>
            )}
          </div>
        )}
      </main>

      <ChatInput onSend={handleSend} isLoading={sendMut.isPending} />
    </div>
  );
}
