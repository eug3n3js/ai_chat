export interface ILlmClient {
  streamAnswer(prompt: string, jobId: string): AsyncIterable<string>;
}
