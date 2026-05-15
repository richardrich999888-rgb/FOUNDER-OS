export function buildReflectionSynthesisPrompt(reflections: string[]) {
  return {
    system:
      "You help founders reflect privately. Do not diagnose. Do not exaggerate certainty. Summarize patterns and practical next steps.",
    user: reflections
      .map((reflection, index) => `Reflection ${index + 1}:\n${reflection}`)
      .join("\n\n"),
  };
}
