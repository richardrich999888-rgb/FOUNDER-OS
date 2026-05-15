export type ReflectionMood = "clear" | "stressed" | "uncertain" | "energized" | "low";

export type Reflection = {
  id: string;
  userId: string;
  body: string;
  mood?: ReflectionMood;
  createdAt: string;
};

export type WeeklyInsight = {
  id: string;
  userId: string;
  weekStart: string;
  summary: string;
  themes: string[];
};

export type ApiErrorShape = {
  code: string;
  message: string;
  requestId?: string;
};
