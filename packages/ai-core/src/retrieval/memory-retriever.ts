import type { AiProvider, MemorySearchResult } from "../types";

export type MemoryVectorStore = {
  searchByEmbedding: (embedding: number[], limit: number) => Promise<MemorySearchResult[]>;
};

export function createMemoryRetriever(provider: AiProvider, store: MemoryVectorStore) {
  return {
    async searchYourOwnMind(query: string, limit = 8) {
      if (!provider.embed) {
        throw new Error(`${provider.name} does not support embeddings`);
      }

      const embedding = await provider.embed({ input: query });
      return store.searchByEmbedding(embedding, limit);
    },
  };
}
