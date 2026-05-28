import type { SupportedLanguage } from '@/types/room';

export interface ExecutionResult {
  language: SupportedLanguage;
  runtime: string;
  version: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  compileStderr: string | null;
  executionTimeMs: number;
}
