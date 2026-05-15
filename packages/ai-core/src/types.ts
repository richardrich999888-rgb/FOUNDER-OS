export type CompletionRequest = {
  system: string;
  user: string;
  model?: string;
};

export type CompletionResponse = {
  text: string;
  provider: string;
  model: string;
};

export type EmbeddingRequest = {
  input: string;
  model?: string;
};

export type AiProvider = {
  name: string;
  complete: (request: CompletionRequest) => Promise<CompletionResponse>;
  embed?: (request: EmbeddingRequest) => Promise<number[]>;
};

export type MemorySearchResult = {
  id: string;
  content: string;
  similarity: number;
  createdAt: string;
};
