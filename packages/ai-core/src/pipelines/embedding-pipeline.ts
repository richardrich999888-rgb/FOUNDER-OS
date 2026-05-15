import type { AiProvider } from "../types";

export function createEmbeddingPipeline(provider: AiProvider) {
  return {
    async embedReflection(input: string) {
      if (!provider.embed) {
        throw new Error(`${provider.name} does not support embeddings`);
      }

      return provider.embed({ input });
    },
  };
}
