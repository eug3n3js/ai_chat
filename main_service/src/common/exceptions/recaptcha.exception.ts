export class RecaptchaOperationError extends Error {
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
      ? `reCAPTCHA "${operation}" failed: ${causeMessage}`
      : `reCAPTCHA "${operation}" failed`;
    super(msg);
    this.info = { operation, ...(causeMessage ? { causeMessage } : {}) };
  }
}
