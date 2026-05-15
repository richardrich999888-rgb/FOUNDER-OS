import { buildReflectionSynthesisPrompt } from "../prompts/reflection-synthesis";
import type { AiProvider } from "../types";

export function createReflectionSynthesisPipeline(provider: AiProvider) {
  return {
    async synthesize(reflections: string[]) {
      const prompt = buildReflectionSynthesisPrompt(reflections);
      return provider.complete(prompt);
    },
  };
}
