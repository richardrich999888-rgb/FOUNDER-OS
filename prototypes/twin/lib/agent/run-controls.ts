export type RunControls = {
  deadlineAt?: number;
  signal?: AbortSignal;
  workflow?: { id: string; version: number };
  validateContext?: () => Promise<void>;
};
