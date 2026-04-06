/** Тело SSE data при именованном событии `event: progress` (часто без поля type). */
export type ProgressPayloadFlat = {
  progress: string;
};

export type ProgressEventDTO = {
  type: "progress";
  data: {
    progress: string;
  };
};

/** Тело SSE data при `event: completed` — часто только returnvalue. */
export type CompletedPayloadFlat = {
  returnvalue: string;
};

export type CompletedEventDTO = {
  type: "completed";
  data: {
    returnvalue: string;
  };
};

export type FailedEventDTO = {
  type: "failed";
  data?: { failedReason?: string };
};

export type SSEMessage = ProgressEventDTO | CompletedEventDTO | FailedEventDTO;

function extractFailedReason(o: Record<string, unknown>): string | undefined {
  if (typeof o.failedReason === "string" && o.failedReason.trim()) {
    return o.failedReason;
  }
  if (o.type === "failed") {
    const data = o.data as { failedReason?: unknown; error?: unknown } | undefined;
    if (typeof data?.failedReason === "string") return data.failedReason;
    if (typeof data?.error === "string") return data.error;
  }
  return undefined;
}

/** Распознаёт оба формата: с `type` и плоский, как в ответе бэкенда. */
export function applySseDataPayload(
  raw: unknown,
  handlers: {
    onProgress: (chunk: string) => void;
    onCompleted: (fullText: string) => void;
    /** Текст ошибки LLM/бэкенда, если есть (например failedReason). */
    onFailed: (reason?: string) => void;
  }
): void {
  if (raw === null || typeof raw !== "object") return;
  const o = raw as Record<string, unknown>;

  if (typeof o.progress === "string") {
    handlers.onProgress(o.progress);
    return;
  }
  if (typeof o.returnvalue === "string") {
    handlers.onCompleted(o.returnvalue);
    return;
  }

  // failed: event: failed + data: {"failedReason":"..."} или плоский JSON
  if (o.type === "failed" || typeof o.failedReason === "string") {
    handlers.onFailed(extractFailedReason(o));
    return;
  }

  if (o.type === "progress") {
    const data = o.data as { progress?: unknown } | undefined;
    const chunk = data?.progress;
    if (typeof chunk === "string") handlers.onProgress(chunk);
    return;
  }
  if (o.type === "completed") {
    const data = o.data as { returnvalue?: unknown } | undefined;
    const text = data?.returnvalue;
    if (typeof text === "string") handlers.onCompleted(text);
    return;
  }
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: Date;
  status: "pending" | "streaming" | "done" | "error";
}
