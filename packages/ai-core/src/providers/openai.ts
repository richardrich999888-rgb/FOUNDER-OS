import OpenAI from "openai";
import type { AiProvider } from "../types";

type OpenAiProviderOptions = {
  apiKey: string;
  completionModel?: string;
  embeddingModel?: string;
};

export function createOpenAiProvider(options: OpenAiProviderOptions): AiProvider {
  const client = new OpenAI({ apiKey: options.apiKey });
  const completionModel = options.completionModel ?? "gpt-4o-mini";
  const embeddingModel = options.embeddingModel ?? "text-embedding-3-small";

  return {
    name: "openai",
    async complete(request) {
      const response = await client.chat.completions.create({
        model: request.model ?? completionModel,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
      });

      return {
        text: response.choices[0]?.message.content ?? "",
        provider: "openai",
        model: request.model ?? completionModel,
      };
    },
    async embed(request) {
      const response = await client.embeddings.create({
        model: request.model ?? embeddingModel,
        input: request.input,
      });

      return response.data[0].embedding;
    },
  };
}
