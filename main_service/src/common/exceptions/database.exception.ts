
export type DbEntity = 'Query' | 'Response' | 'RequestLog';

export class DatabaseOperationError extends Error {

  readonly info: {
    entity: DbEntity;
    operation: string;
    causeMessage?: string;
  };

  constructor(
    public readonly entity: DbEntity,
    public readonly operation: string,
    cause?: unknown,
  ) {
    const causeMessage =
      cause instanceof Error ? cause.message : cause !== null && cause !== undefined ? String(cause) : undefined;
    const msg = causeMessage
      ? `DB [${entity}] ${operation}: ${causeMessage}`
      : `DB [${entity}] ${operation} failed`;
    super(msg);
    this.info = {
      entity,
      operation,
      ...(causeMessage ? { causeMessage } : {}),
    };
  }
}

