/**
 * search_personal_memory — read-only retrieval over the authenticated user's confirmed
 * memories and user-imported documents.
 *
 * Security properties:
 *  - Arguments contain ONLY `query`. The Zod schema is `.strict()`, so a model-supplied
 *    `userId`, `owner`, `scope` or any other key is rejected before authorization.
 *  - The owner is taken exclusively from `context.principal.userId`.
 *  - Retrieval reuses the existing deterministic Memory-mode implementation
 *    (`retrieveWithProvenance`), which excludes suggested (unconfirmed) memories.
 */
import { z } from 'zod';
import { retrieveWithProvenance, type State } from '../../twin/core';
import type { ToolContext, ToolDefinition, ToolResultSummary } from '../tool-registry';

export const SEARCH_PERSONAL_MEMORY = 'search_personal_memory';

/** Minimal read port. Implementations MUST scope the read to `userId`. */
export type PersonalCorpusReader = Readonly<{
  loadCorpus(userId: string, signal: AbortSignal): Promise<Pick<State, 'memories' | 'documents'> | null>;
}>;

const QUERY_MAX_CHARS = 500;

const argsSchema = z
  .object({ query: z.string().trim().min(1).max(QUERY_MAX_CHARS) })
  .strict();

const resultItemSchema = z
  .object({
    sourceId: z.string().regex(/^(memory:[A-Za-z0-9-]{1,64}|document:[A-Za-z0-9-]{1,64}#\d{1,6})$/),
    kind: z.enum(['memory', 'document']),
    label: z.string().max(400),
    excerpt: z.string().max(2_000),
    createdAt: z.string().max(64),
    updatedAt: z.string().max(64),
  })
  .strict();

const resultSchema = z
  .object({
    status: z.enum(['ok', 'no_evidence']),
    results: z.array(resultItemSchema).max(5),
  })
  .strict()
  // Invariant: status must agree with the result count, so "no_evidence" can never carry data.
  .refine((r) => (r.status === 'ok') === (r.results.length > 0), { message: 'status/result mismatch' });

export type SearchPersonalMemoryArgs = z.infer<typeof argsSchema>;
export type SearchPersonalMemoryResult = z.infer<typeof resultSchema>;

/** Build the tool bound to a corpus reader. */
export function createSearchPersonalMemoryTool(
  reader: PersonalCorpusReader,
): ToolDefinition<SearchPersonalMemoryArgs, SearchPersonalMemoryResult> {
  return {
    name: SEARCH_PERSONAL_MEMORY,
    description:
      "Search the signed-in user's confirmed personal memories and documents they imported. " +
      'Use for any question about the user, their plans, preferences, goals, people or notes. ' +
      'Returns cited evidence or an explicit no_evidence status.',
    requiredScope: 'memory:read',
    sideEffects: 'none',
    argsSchema,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords describing what to look for (max 500 characters).' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    resultSchema,
    async execute(args: SearchPersonalMemoryArgs, context: ToolContext): Promise<SearchPersonalMemoryResult> {
      const corpus = await reader.loadCorpus(context.principal.userId, context.signal);
      if (!corpus) return { status: 'no_evidence', results: [] };
      const state: State = { name: '', aiConsent: false, createdAt: '', tasks: [], activity: [], ...corpus };
      // Explicit projection: only allow-listed fields leave the tool (score is internal).
      const results = retrieveWithProvenance(args.query, state).map((r) => ({
        sourceId: r.sourceId,
        kind: r.kind,
        label: r.label,
        excerpt: r.excerpt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
      return results.length ? { status: 'ok', results } : { status: 'no_evidence', results: [] };
    },
    summarize(result: SearchPersonalMemoryResult): ToolResultSummary {
      return { status: result.status, evidence: result.results };
    },
  };
}
