import type { SupportedLanguage } from '@/constants/index.js';

export interface ExecuteRequest {
  language: SupportedLanguage;
  code: string;
  stdin?: string;
}

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
