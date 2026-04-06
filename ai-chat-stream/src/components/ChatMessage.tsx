import { memo } from "react";
import ReactMarkdown from "react-markdown";
import { ChatMessage as ChatMessageType } from "@/types/sse";
import { RotateCcw } from "lucide-react";

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse-dot" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse-dot [animation-delay:200ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse-dot [animation-delay:400ms]" />
    </span>
  );
}

interface Props {
  message: ChatMessageType;
  onRetry?: (id: string) => void;
}

export const ChatMessageBubble = memo(function ChatMessageBubble({
  message,
  onRetry,
}: Props) {
  const isUser = message.role === "user";
  const isError = message.status === "error";
  const isPending = message.status === "pending";
  const isStreaming = message.status === "streaming";

  return (
    <div
      className={`flex animate-fade-in-up ${isUser ? "justify-end" : "justify-start"} mb-3`}
    >
      <div
        className={`relative max-w-[80%] md:max-w-[70%] rounded-2xl px-4 py-3 text-[0.9375rem] leading-relaxed shadow-sm transition-shadow ${
          isUser
            ? "bg-chat-user text-chat-user-foreground rounded-br-md"
            : isError
              ? "bg-destructive/10 text-destructive rounded-bl-md border border-destructive/20"
              : "bg-chat-assistant text-chat-assistant-foreground rounded-bl-md border border-border"
        }`}
      >
        {isPending && !message.content ? (
          <TypingDots />
        ) : isUser ? (
          <p className="whitespace-pre-wrap break-words overflow-wrap-anywhere">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none break-words overflow-wrap-anywhere [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown>{message.content}</ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-[2px] h-4 bg-foreground/60 ml-0.5 animate-pulse align-text-bottom" />
            )}
          </div>
        )}

        {isError && onRetry && (
          <button
            onClick={() => onRetry(message.id)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition-colors active:scale-95"
          >
            <RotateCcw className="h-3 w-3" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
});
