import { apiFetch } from "./client";

export type Reflection = {
  id: string;
  body: string;
  mood?: string | null;
  source: string;
  created_at: string;
};

export type MemorySearchItem = {
  id: string;
  source_reflection_id?: string | null;
  content: string;
  similarity: number;
  created_at: string;
};

export type WeeklyInsight = {
  id: string;
  week_start: string;
  summary: string;
  themes: string[];
  source_reflection_ids: string[];
  created_at: string;
};

export async function listReflections(token?: string | null) {
  return apiFetch<{ items: Reflection[] }>("/api/v1/reflections", { token });
}

export async function createReflection(body: string, token?: string | null) {
  return apiFetch<Reflection>("/api/v1/reflections", {
    token,
    method: "POST",
    body: JSON.stringify({ body, source: "text" }),
  });
}

export async function submitReflectionFeedback(
  reflectionId: string,
  usefulness: "useful" | "somewhat" | "not_useful",
  token?: string | null,
) {
  return apiFetch<void>(`/api/v1/reflections/${reflectionId}/feedback`, {
    token,
    method: "POST",
    body: JSON.stringify({ usefulness }),
  });
}

export async function searchMemory(query: string, token?: string | null) {
  return apiFetch<{ items: MemorySearchItem[] }>(
    `/api/v1/memory/search?q=${encodeURIComponent(query)}`,
    { token },
  );
}

export async function evaluateRetrieval(
  query: string,
  items: MemorySearchItem[],
  userRating: "found_it" | "close" | "missed",
  token?: string | null,
) {
  return apiFetch<void>("/api/v1/memory/evaluate", {
    token,
    method: "POST",
    body: JSON.stringify({
      query,
      user_rating: userRating,
      result_count: items.length,
      top_memory_ids: items.slice(0, 5).map((item) => item.id),
    }),
  });
}

export async function createWeeklyInsight(token?: string | null) {
  return apiFetch<WeeklyInsight>("/api/v1/ai/weekly-insight", {
    token,
    method: "POST",
    body: JSON.stringify({ max_reflections: 25 }),
  });
}

export async function tagWeeklyInsight(
  insightId: string,
  rating: "useful" | "somewhat" | "not_useful",
  tags: string[],
  token?: string | null,
) {
  return apiFetch<void>("/api/v1/ai/quality-tags", {
    token,
    method: "POST",
    body: JSON.stringify({
      output_type: "weekly_insight",
      output_id: insightId,
      rating,
      tags,
    }),
  });
}

export async function trackEvent(
  eventName: string,
  properties: Record<string, string | number | boolean> = {},
  token?: string | null,
) {
  return apiFetch<void>("/api/v1/analytics/events", {
    token,
    method: "POST",
    body: JSON.stringify({
      event_name: eventName,
      platform: "mobile",
      properties,
    }),
  });
}

export async function requestExport(token?: string | null) {
  return apiFetch<{ status: string }>("/api/v1/exports", {
    token,
    method: "POST",
  });
}

export async function deleteAccount(token?: string | null) {
  return apiFetch<void>("/api/v1/users/me", {
    token,
    method: "DELETE",
  });
}
