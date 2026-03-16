export interface ILlmClient {
  streamAnswer(prompt: string): AsyncIterable<string>;
}
