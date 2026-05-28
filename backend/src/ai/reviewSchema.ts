import { z } from 'zod';

/**
 * Runtime validator for the JSON the LLM is asked to return. Any provider
 * adapter should run its raw response through this before handing it back
 * to the service so the rest of the app sees a known shape.
 */
export const reviewPayloadSchema = z.object({
  timeComplexity: z.string().min(1).max(60),
  spaceComplexity: z.string().min(1).max(60),
  summary: z.string().min(1).max(800),
  suggestions: z.array(z.string().min(1).max(500)).max(10),
  bugs: z
    .array(
      z.object({
        line: z.number().int().min(0).max(100_000),
        severity: z.enum(['low', 'medium', 'high']),
        description: z.string().min(1).max(500),
      }),
    )
    .max(20),
  securityConcerns: z.array(z.string().min(1).max(500)).max(10),
  score: z.number().int().min(1).max(100),
});

export type ReviewPayload = z.infer<typeof reviewPayloadSchema>;
