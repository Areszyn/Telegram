import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { API_BASE } from "@/lib/api";
import {
  Bot, Send, Plus, Trash2, ChevronDown, Sparkles, Menu, X,
  MessageSquare, Zap, Code, Lightbulb, PenTool, Globe,
} from "lucide-react";

interface Model {
  id: string;
  label: string;
  provider: "openai" | "anthropic" | "gemini";
}

interface Conversation {
  id: number;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  model: string;
  created_at: string;
}

const PROVIDER_COLORS: Record<string, string> = {
  openai: "from-emerald-500 to-teal-600",
  anthropic: "from-orange-500 to-amber-600",
  gemini: "from-blue-500 to-indigo-600",
};

const PROVIDER_BG: Record<string, string> = {
  openai: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  anthropic: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  gemini: "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

const PROVIDER_ICONS: Record<string, string> = {
  openai: "🤖",
  anthropic: "🧠",
  gemini: "✨",
};

const SUGGESTIONS = [
  { icon: Code, text: "Write code", prompt: "Help me write a function that " },
  { icon: Lightbulb, text: "Explain a concept", prompt: "Explain in simple terms: " },
  { icon: PenTool, text: "Write content", prompt: "Write a professional " },
  { icon: Globe, text: "Translate text", prompt: "Translate the following to " },
  { icon: Zap, text: "Brainstorm ideas", prompt: "Give me 5 creative ideas for " },
  { icon: MessageSquare, text: "Summarize text", prompt: "Summarize the following:\n\n" },
];

function formatMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g,
    (_m, lang, code) => `<pre class="bg-black/40 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono border border-white/10"><code>${code.trim()}</code></pre>`
  );
  html = html.replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold mt-3 mb-1">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-base font-bold mt-3 mb-1">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold mt-3 mb-1">$1</h1>');
  html = html.replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');
  html = html.replace(/\n/g, "<br/>");
  return html;
}

export function AiChat() {
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  const [models, setModels] = useState<Model[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-5.2");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/ai/models`, { headers }).then(r => r.json()).then(d => {
      if (d.models) setModels(d.models);
    }).catch(() => {});
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const r = await fetch(`${API_BASE}/ai/conversations`, { headers });
      const d = await r.json();
      if (d.conversations) setConversations(d.conversations);
    } catch {}
  };

  const loadConversation = async (id: number) => {
    try {
      const r = await fetch(`${API_BASE}/ai/conversations/${id}`, { headers });
      const d = await r.json();
      if (d.messages) {
        setMessages(d.messages);
        setActiveConv(id);
        if (d.conversation?.model) setSelectedModel(d.conversation.model);
        setShowSidebar(false);
        setTimeout(scrollToBottom, 100);
      }
    } catch {}
  };

  const createConversation = async () => {
    try {
      const r = await fetch(`${API_BASE}/ai/conversations`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel }),
      });
      const d = await r.json();
      if (d.conversation) {
        setActiveConv(d.conversation.id);
        setMessages([]);
        setShowSidebar(false);
        await loadConversations();
      }
    } catch {}
  };

  const deleteConversation = async (id: number) => {
    try {
      await fetch(`${API_BASE}/ai/conversations/${id}`, {
        method: "DELETE",
        headers,
      });
      if (activeConv === id) {
        setActiveConv(null);
        setMessages([]);
      }
      await loadConversations();
    } catch {}
  };

  const sendMessage = async (text?: string) => {
    const msgText = (text || input).trim();
    if (!msgText || isStreaming) return;
    setInput("");
    setError("");

    if (!activeConv) {
      try {
        const r = await fetch(`${API_BASE}/ai/conversations`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ model: selectedModel }),
        });
        const d = await r.json();
        if (!d.conversation) { setError("Failed to create conversation"); return; }
        setActiveConv(d.conversation.id);
        await sendToConversation(d.conversation.id, msgText);
        await loadConversations();
      } catch (e) { setError("Failed to create conversation"); }
      return;
    }

    await sendToConversation(activeConv, msgText);
    await loadConversations();
  };

  const sendToConversation = async (convId: number, text: string) => {
    const userMsg: Message = {
      id: Date.now(),
      role: "user",
      content: text,
      model: selectedModel,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamText("");
    setTimeout(scrollToBottom, 50);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const r = await fetch(`${API_BASE}/ai/conversations/${convId}/messages`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, model: selectedModel }),
        signal: ctrl.signal,
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Request failed" }));
        setError(err.error || "Request failed");
        setIsStreaming(false);
        return;
      }

      const reader = r.body?.getReader();
      if (!reader) { setIsStreaming(false); return; }

      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.content) {
              accumulated += parsed.content;
              setStreamText(accumulated);
              scrollToBottom();
            }
            if (parsed.error) {
              setError(parsed.error);
            }
            if (parsed.done) {
              if (accumulated) {
                const assistantMsg: Message = {
                  id: Date.now() + 1,
                  role: "assistant",
                  content: accumulated,
                  model: selectedModel,
                  created_at: new Date().toISOString(),
                };
                setMessages(prev => [...prev, assistantMsg]);
                setStreamText("");
              }
            }
          } catch {}
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setError(e.message);
      }
    }

    setIsStreaming(false);
    abortRef.current = null;
    setTimeout(scrollToBottom, 100);
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    if (streamText) {
      const assistantMsg: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: streamText + "\n\n*(stopped)*",
        model: selectedModel,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setStreamText("");
    }
    setIsStreaming(false);
  };

  const currentModel = models.find(m => m.id === selectedModel);
  const provider = currentModel?.provider || "openai";

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Layout title="AI Chat">
      <div className="flex h-[calc(100vh-120px)] relative">
        {showSidebar && (
          <div className="fixed inset-0 z-40 flex">
            <div className="w-72 bg-[#0a0a0f] border-r border-white/10 flex flex-col h-full overflow-hidden">
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-sm font-medium text-white/70">Conversations</span>
                <div className="flex gap-1">
                  <button onClick={createConversation}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                    <Plus size={16} className="text-white/60" />
                  </button>
                  <button onClick={() => setShowSidebar(false)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                    <X size={16} className="text-white/60" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {conversations.map(conv => (
                  <div key={conv.id}
                    className={`group flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all ${
                      activeConv === conv.id ? "bg-white/10 border border-white/20" : "hover:bg-white/5"
                    }`}
                    onClick={() => loadConversation(conv.id)}>
                    <MessageSquare size={14} className="text-white/40 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/80 truncate">{conv.title}</p>
                      <p className="text-[10px] text-white/30">{conv.model}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 transition-all">
                      <Trash2 size={12} className="text-red-400" />
                    </button>
                  </div>
                ))}
                {conversations.length === 0 && (
                  <p className="text-xs text-white/30 text-center py-8">No conversations yet</p>
                )}
              </div>
            </div>
            <div className="flex-1 bg-black/50" onClick={() => setShowSidebar(false)} />
          </div>
        )}

        <div className="flex-1 flex flex-col w-full">
          <div className="flex items-center gap-2 p-2 border-b border-white/10 bg-[#0c0c14]/80 backdrop-blur-sm">
            <button onClick={() => setShowSidebar(true)}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors">
              <Menu size={18} className="text-white/60" />
            </button>

            <div className="relative flex-1">
              <button
                onClick={() => setShowModelPicker(!showModelPicker)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${PROVIDER_BG[provider]}`}>
                <span>{PROVIDER_ICONS[provider]}</span>
                <span>{currentModel?.label || selectedModel}</span>
                <ChevronDown size={12} />
              </button>

              {showModelPicker && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-[#12121a] border border-white/10 rounded-xl shadow-2xl z-50 p-2 space-y-1">
                  {models.map(m => (
                    <button key={m.id}
                      onClick={() => { setSelectedModel(m.id); setShowModelPicker(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                        selectedModel === m.id ? "bg-white/10" : "hover:bg-white/5"
                      }`}>
                      <span className="text-lg">{PROVIDER_ICONS[m.provider]}</span>
                      <div>
                        <p className="text-xs font-medium text-white/90">{m.label}</p>
                        <p className="text-[10px] text-white/40 capitalize">{m.provider}</p>
                      </div>
                      {selectedModel === m.id && <Sparkles size={14} className="ml-auto text-yellow-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => { setActiveConv(null); setMessages([]); setStreamText(""); }}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              title="New chat">
              <Plus size={18} className="text-white/60" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !streamText && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${PROVIDER_COLORS[provider]} flex items-center justify-center mb-4 shadow-lg`}>
                  <Bot size={32} className="text-white" />
                </div>
                <h2 className="text-lg font-bold text-white/90 mb-1">AI Assistant</h2>
                <p className="text-xs text-white/40 mb-6 max-w-xs">
                  Chat with {currentModel?.label || "AI"} — ask anything, get instant answers with streaming responses.
                </p>
                <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i}
                      onClick={() => { setInput(s.prompt); inputRef.current?.focus(); }}
                      className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left">
                      <s.icon size={14} className="text-white/50 flex-shrink-0" />
                      <span className="text-xs text-white/70">{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] ${
                  msg.role === "user"
                    ? "bg-indigo-600/80 rounded-2xl rounded-br-md px-4 py-2.5"
                    : "bg-white/5 rounded-2xl rounded-bl-md px-4 py-2.5 border border-white/5"
                }`}>
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs">{PROVIDER_ICONS[getProviderForModel(msg.model)]}</span>
                      <span className="text-[10px] text-white/30 font-medium">{msg.model}</span>
                    </div>
                  )}
                  <div className="text-sm text-white/90 leading-relaxed ai-content"
                    dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
                </div>
              </div>
            ))}

            {streamText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] bg-white/5 rounded-2xl rounded-bl-md px-4 py-2.5 border border-white/5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs">{PROVIDER_ICONS[provider]}</span>
                    <span className="text-[10px] text-white/30 font-medium">{selectedModel}</span>
                    <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  </div>
                  <div className="text-sm text-white/90 leading-relaxed ai-content"
                    dangerouslySetInnerHTML={{ __html: formatMarkdown(streamText) }} />
                </div>
              </div>
            )}

            {isStreaming && !streamText && (
              <div className="flex justify-start">
                <div className="bg-white/5 rounded-2xl rounded-bl-md px-4 py-3 border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{PROVIDER_ICONS[provider]}</span>
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mx-auto max-w-sm bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <p className="text-xs text-red-400 text-center">{error}</p>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-white/10 bg-[#0c0c14]/80 backdrop-blur-sm">
            {isStreaming ? (
              <button onClick={stopStreaming}
                className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors">
                ■ Stop generating
              </button>
            ) : (
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  rows={1}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-white/20 transition-colors"
                  style={{ maxHeight: "120px", minHeight: "42px" }}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = Math.min(el.scrollHeight, 120) + "px";
                  }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim()}
                  className={`p-2.5 rounded-xl transition-all ${
                    input.trim()
                      ? `bg-gradient-to-r ${PROVIDER_COLORS[provider]} text-white shadow-lg`
                      : "bg-white/5 text-white/20"
                  }`}>
                  <Send size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function getProviderForModel(model: string): string {
  if (model.startsWith("gpt")) return "openai";
  if (model.startsWith("gemini")) return "gemini";
  return "anthropic";
}
