import type { SupportedLanguage } from '@/constants/index.js';

export interface ExecuteRequest {
  language: SupportedLanguage;
  code: string;
  stdin?: string;
}

/** Stage 4 multi-file execute payload (types only until API accepts it). */
export interface ExecuteProjectFile {
  path: string;
  content: string;
}

export interface ExecuteProjectRequest {
  language: SupportedLanguage;
  entryPoint: string;
  files: ExecuteProjectFile[];
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
