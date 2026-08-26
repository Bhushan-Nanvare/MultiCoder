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

export type RunScope = 'project' | 'file';

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
