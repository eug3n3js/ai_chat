import { useState, useCallback, useRef } from "react";
import { applySseDataPayload, ChatMessage } from "@/types/sse";
import { apiUrl, isRecaptchaConfigured } from "@/config";
import { useRecaptcha } from "./useRecaptcha";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const BOT_ACTIVITY_MESSAGE = "Bot activity detected.";
const RATE_LIMIT_MESSAGE =
  "Too many requests. Please wait a moment and try again.";

const FETCH_BLOCKED_MESSAGE = `${RATE_LIMIT_MESSAGE}`;

function isLikelyFetchBlocked(err: unknown): boolean {
  return (
    err instanceof TypeError &&
    /failed to fetch|load failed|networkerror/i.test(String(err.message))
  );
}

function rateLimitContent(res: Response): string {
  const ra = res.headers.get("Retry-After");
  if (!ra) return RATE_LIMIT_MESSAGE;
  return `${RATE_LIMIT_MESSAGE} (retry after ${ra}s)`;
}

async function authenticate(recaptchaToken: string): Promise<{
  ok: boolean;
  botBlocked: boolean;
  rateLimited: boolean;
}> {
  const res = await fetch(apiUrl("/auth"), {
    method: "GET",
    credentials: "include",
    headers: { "x-recaptcha-token": recaptchaToken },
  });

  if (res.status === 204) {
    return { ok: true, botBlocked: false, rateLimited: false };
  }
  if (res.status === 403) {
    return { ok: false, botBlocked: true, rateLimited: false };
  }
  if (res.status === 429) {
    return { ok: false, botBlocked: false, rateLimited: true };
  }
  return { ok: false, botBlocked: false, rateLimited: false };
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "AbortError"
  );
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const { getToken } = useRecaptcha();

  const updateAssistant = useCallback(
    (id: string, updater: (msg: ChatMessage) => Partial<ChatMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updater(m) } : m))
      );
    },
    []
  );

  const startSSE = useCallback(
    (text: string, assistantId: string) => {
      const sseUrl = `${apiUrl("/queries/sse")}?text=${encodeURIComponent(text)}`;
      const controller = new AbortController();
      abortRef.current = () => controller.abort();

      const fetchOpts: RequestInit = {
        credentials: "include",
        signal: controller.signal,
      };

      setIsStreaming(true);
      updateAssistant(assistantId, () => ({ status: "streaming" }));

      void (async () => {
        try {
          let res = await fetch(sseUrl, fetchOpts);

          if (res.status === 429) {
            updateAssistant(assistantId, () => ({
              content: rateLimitContent(res),
              status: "error",
            }));
            return;
          }

          if (res.status === 401) {
            try {
              if (isRecaptchaConfigured) {
                const token = await getToken();
                const auth = await authenticate(token);
                if (auth.botBlocked) {
                  updateAssistant(assistantId, () => ({
                    content: BOT_ACTIVITY_MESSAGE,
                    status: "error",
                  }));
                  return;
                }
                if (auth.rateLimited) {
                  updateAssistant(assistantId, () => ({
                    content: RATE_LIMIT_MESSAGE,
                    status: "error",
                  }));
                  return;
                }
                if (auth.ok) {
                  res = await fetch(sseUrl, fetchOpts);
                }
              }
            } catch {
              /* fall through */
            }
            if (res.status === 429) {
              updateAssistant(assistantId, () => ({
                content: rateLimitContent(res),
                status: "error",
              }));
              return;
            }
            if (res.status === 401) {
              updateAssistant(assistantId, () => ({
                content: "Session expired. Please refresh and try again.",
                status: "error",
              }));
              return;
            }
          }

          if (res.status === 403) {
            updateAssistant(assistantId, () => ({
              content: BOT_ACTIVITY_MESSAGE,
              status: "error",
            }));
            return;
          }

          if (res.status === 429) {
            updateAssistant(assistantId, () => ({
              content: rateLimitContent(res),
              status: "error",
            }));
            return;
          }

          if (!res.ok) {
            updateAssistant(assistantId, () => ({
              content: `Server error (${res.status}). Please try again.`,
              status: "error",
            }));
            return;
          }

          const reader = res.body?.getReader();
          if (!reader) {
            updateAssistant(assistantId, () => ({
              content: "No response body from server.",
              status: "error",
            }));
            return;
          }

          const decoder = new TextDecoder();
          let buffer = "";

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                const row = line.replace(/\r$/, "");
                if (!row.startsWith("data:")) continue;
                const raw = row.slice(5).trim();
                if (!raw || raw === "[DONE]") continue;

                try {
                  const parsed: unknown = JSON.parse(raw);
                  applySseDataPayload(parsed, {
                    onProgress: (chunk) => {
                      updateAssistant(assistantId, (m) => ({
                        content: m.content + chunk,
                      }));
                    },
                    onCompleted: (fullText) => {
                      updateAssistant(assistantId, () => ({
                        content: fullText,
                        status: "done",
                      }));
                    },
                    onFailed: (reason) => {
                      const msg = reason?.trim()
                        ? `LLM error: ${reason.trim()}`
                        : "Query failed (LLM or server error).";
                      updateAssistant(assistantId, () => ({
                        content: msg,
                        status: "error",
                      }));
                    },
                  });
                } catch {
                  updateAssistant(assistantId, (m) => ({
                    content: m.content + raw,
                  }));
                }
              }
            }
          } catch (streamErr: unknown) {
            if (isAbortError(streamErr)) throw streamErr;
            updateAssistant(assistantId, () => ({
              content: "Stream interrupted. Please try again.",
              status: "error",
            }));
            return;
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId && m.status === "streaming"
                ? { ...m, status: "done" }
                : m
            )
          );
        } catch (err: unknown) {
          if (isAbortError(err)) {
            updateAssistant(assistantId, (m) => ({
              status: m.content ? "done" : "error",
              content: m.content || "Response cancelled.",
            }));
          } else if (isLikelyFetchBlocked(err)) {
            updateAssistant(assistantId, () => ({
              content: FETCH_BLOCKED_MESSAGE,
              status: "error",
            }));
          } else {
            updateAssistant(assistantId, () => ({
              content: "Connection lost. Please check your network.",
              status: "error",
            }));
          }
        } finally {
          setIsStreaming(false);
          abortRef.current = null;
        }
      })();
    },
    [getToken, updateAssistant, isRecaptchaConfigured]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: text,
        timestamp: new Date(),
        status: "done",
      };
      const assistantMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
        status: "pending",
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      // /auth вызывается только при 401 от SSE (см. startSSE), не перед каждым сообщением
      startSSE(text, assistantMsg.id);
    },
    [startSSE]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.();
  }, []);

  const retry = useCallback(
    (messageId: string) => {
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx < 1) return;
      const userMsg = messages[idx - 1];
      if (userMsg.role !== "user") return;

      updateAssistant(messageId, () => ({
        content: "",
        status: "pending",
      }));
      startSSE(userMsg.content, messageId);
    },
    [messages, startSSE, updateAssistant]
  );

  return { messages, isStreaming, sendMessage, stopStreaming, retry };
}
