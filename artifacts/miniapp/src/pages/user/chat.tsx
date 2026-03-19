import { useEffect, useRef } from "react";
import { useGetMyMessages, useSendMessage } from "@workspace/api-client-react";
import { useApiAuth } from "@/lib/telegram-context";
import { Layout } from "@/components/layout";
import { MessageBubble } from "@/components/message-bubble";
import { ChatInput } from "@/components/chat-input";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMyMessagesQueryKey } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export function UserChat() {
  const reqOpts = useApiAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useGetMyMessages({
    request: reqOpts,
    query: { refetchInterval: 3000 } // Poll for new messages
  });

  const sendMut = useSendMessage({
    request: reqOpts,
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyMessagesQueryKey() });
      }
    }
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (text: string) => {
    sendMut.mutate({ data: { text } });
  };

  return (
    <Layout title="Support Chat">
      <div className="flex flex-col h-full bg-background relative">
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 scroll-smooth"
        >
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : messages?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-70">
              <img 
                src={`${import.meta.env.BASE_URL}images/empty-chat.png`} 
                alt="Empty chat" 
                className="w-48 h-48 mb-6 object-contain drop-shadow-2xl"
              />
              <h3 className="text-xl font-semibold mb-2">No messages yet</h3>
              <p className="text-sm text-muted-foreground max-w-[250px]">
                Send a message below and an admin will reply shortly.
              </p>
            </div>
          ) : (
            <div className="flex flex-col justify-end min-h-full">
              {messages?.map((msg) => (
                <MessageBubble 
                  key={msg.id} 
                  message={msg} 
                  isOwn={msg.sender_type === "user"} 
                />
              ))}
            </div>
          )}
        </div>
        
        <ChatInput onSend={handleSend} isLoading={sendMut.isPending} />
      </div>
    </Layout>
  );
}
