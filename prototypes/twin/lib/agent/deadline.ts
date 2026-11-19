/**
 * Bounded execution. `runBounded` races the task against (a) its own timeout and (b) the
 * parent run signal. The race guarantees termination even if the task ignores its AbortSignal;
 * the task's signal is also aborted so cooperative I/O (fetch, D1) stops promptly.
 */
import { AgentError, type ErrorCode } from './errors';

export type Clock = Readonly<{ now(): number }>;

export const systemClock: Clock = Object.freeze({ now: () => Date.now() });

export async function runBounded<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  parent: AbortSignal,
  timeoutCode: ErrorCode,
): Promise<T> {
  if (parent.aborted || timeoutMs <= 0) throw new AgentError(parent.aborted ? 'DEADLINE_EXCEEDED' : timeoutCode);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onParentAbort: (() => void) | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AgentError(timeoutCode));
    }, timeoutMs);
  });
  const parentAbort = new Promise<never>((_, reject) => {
    onParentAbort = () => {
      controller.abort();
      reject(new AgentError('DEADLINE_EXCEEDED'));
    };
    parent.addEventListener('abort', onParentAbort, { once: true });
  });
  try {
    return await Promise.race([task(controller.signal), timeout, parentAbort]);
  } finally {
    clearTimeout(timer);
    if (onParentAbort) parent.removeEventListener('abort', onParentAbort);
  }
}
