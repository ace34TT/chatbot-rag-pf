export interface QueryResult {
  id: string;
  score: number | undefined;
  text: string;
  fileName: string;
  documentId: string;
  chunkIndex: number;
}
