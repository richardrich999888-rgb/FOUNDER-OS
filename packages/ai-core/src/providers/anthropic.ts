import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider } from "../types";

type AnthropicProviderOptions = {
  apiKey: string;
  completionModel?: string;
};

export function createAnthropicProvider(options: AnthropicProviderOptions): AiProvider {
  const client = new Anthropic({ apiKey: options.apiKey });
  const completionModel = options.completionModel ?? "claude-3-5-sonnet-latest";

  return {
    name: "anthropic",
    async complete(request) {
      const response = await client.messages.create({
        model: request.model ?? completionModel,
        max_tokens: 1200,
        system: request.system,
        messages: [{ role: "user", content: request.user }],
      });

      const text = response.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("");

      return {
        text,
        provider: "anthropic",
        model: request.model ?? completionModel,
      };
    },
  };
}
