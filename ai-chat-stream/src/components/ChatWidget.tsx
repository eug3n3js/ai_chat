import { useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { ChatMessageBubble } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Bot } from "lucide-react";

export function ChatWidget() {
  const { messages, isStreaming, sendMessage, stopStreaming, retry } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-screen flex-col bg-chat-surface">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 shadow-sm">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground leading-tight">
            AI Assistant
          </h1>
          <p className="text-xs text-muted-foreground">
            {isStreaming ? "Typing…" : "Online"}
          </p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center pt-24 text-center animate-fade-in-up">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                <Bot className="h-7 w-7 text-primary" />
              </div>
              <p className="text-lg font-medium text-foreground">
                How can I help you today?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Type a message below to get started.
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessageBubble
              key={msg.id}
              message={msg}
              onRetry={msg.status === "error" ? retry : undefined}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        onStop={stopStreaming}
        isStreaming={isStreaming}
      />
    </div>
  );
}
