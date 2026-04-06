
export class RedisOperationError extends Error {

  readonly info: {
    operation: string;
    causeMessage?: string;
  };

  constructor(
    public readonly operation: string,
    cause?: unknown,
  ) {
    const causeMessage =
      cause instanceof Error ? cause.message : cause !== null && cause !== undefined ? String(cause) : undefined;
    const msg = causeMessage
      ? `Redis "${operation}" failed: ${causeMessage}`
      : `Redis "${operation}" failed`;
    super(msg);
    this.info = { operation, ...(causeMessage ? { causeMessage } : {}) };
  }
}

