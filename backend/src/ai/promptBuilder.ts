import type { ReviewRequest } from '@/ai/types.js';

const SYSTEM_INSTRUCTION = `You are a senior software engineer performing a focused code review.

Be terse, specific, and actionable. Cite line numbers exactly as they appear in the user's snippet (1-indexed). Do not invent issues; if the snippet is too short to have bugs, return an empty bugs array. Score 1-100 where 90+ means production-ready, 70-89 means decent but needs refactoring, below 70 has significant issues.`;

export function buildSystemInstruction(): string {
  return SYSTEM_INSTRUCTION;
}

export function buildReviewPrompt(request: ReviewRequest): string {
  return [
    `Review the following ${request.language} code and return the structured JSON.`,
    '',
    '```' + request.language,
    request.code,
    '```',
  ].join('\n');
}
