export interface CreateRequestLogDto {
  startTime: Date;
  queryId?: string;
  requestText?: string;
  embedding?: number[];
}