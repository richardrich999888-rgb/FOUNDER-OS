export type MemoryRecord = {
  id: string;
  userId: string;
  sourceReflectionId?: string;
  content: string;
  embedding: number[];
  createdAt: string;
};
