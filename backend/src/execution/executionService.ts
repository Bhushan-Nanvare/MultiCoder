import type { SupportedLanguage } from '@/constants/index.js';
import { EXECUTION_MAX_CODE_BYTES, EXECUTION_MAX_STDIN_BYTES } from '@/constants/index.js';
import type {
  PistonClient,
  PistonExecuteResponse,
} from '@/execution/pistonClient.js';
import type { ExecuteRequest, ExecutionResult } from '@/execution/types.js';
import { AppError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';

interface LanguageMapping {
  pistonLanguage: string;
  fileName: string;
}

const LANGUAGE_MAPPINGS: Record<SupportedLanguage, LanguageMapping> = {
  javascript: { pistonLanguage: 'javascript', fileName: 'main.js' },
  python: { pistonLanguage: 'python', fileName: 'main.py' },
  cpp: { pistonLanguage: 'cpp', fileName: 'main.cpp' },
};

/**
 * Resolves the latest available Piston version per supported language at
 * startup, then runs user code against that runtime. Caching the version
 * mapping avoids a /runtimes hit on every execute call and protects us from
 * silent breakage when Piston rotates default versions.
 */
export class ExecutionService {
  private versions: Record<SupportedLanguage, string> | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private readonly piston: PistonClient) {}

  async initialize(): Promise<void> {
    if (this.versions) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const runtimes = await this.piston.listRuntimes();
      const resolved: Partial<Record<SupportedLanguage, string>> = {};
      for (const [lang, mapping] of Object.entries(LANGUAGE_MAPPINGS) as Array<
        [SupportedLanguage, LanguageMapping]
      >) {
        const match = runtimes.find(
          (runtime) =>
            runtime.language === mapping.pistonLanguage ||
            (runtime.aliases ?? []).includes(mapping.pistonLanguage),
        );
        if (!match) {
          throw new AppError(
            `Piston has no runtime for language "${lang}" (looked for "${mapping.pistonLanguage}")`,
            500,
            'EXECUTION_RUNTIME_MISSING',
          );
        }
        resolved[lang] = match.version;
      }
      this.versions = resolved as Record<SupportedLanguage, string>;
      logger.info({ versions: this.versions }, 'Resolved Piston runtime versions');
    })();

    return this.initPromise;
  }

  async execute(request: ExecuteRequest): Promise<ExecutionResult> {
    if (Buffer.byteLength(request.code, 'utf8') > EXECUTION_MAX_CODE_BYTES) {
      throw new AppError(
        `Code exceeds ${EXECUTION_MAX_CODE_BYTES} bytes`,
        413,
        'EXECUTION_CODE_TOO_LARGE',
      );
    }
    if (request.stdin && Buffer.byteLength(request.stdin, 'utf8') > EXECUTION_MAX_STDIN_BYTES) {
      throw new AppError(
        `stdin exceeds ${EXECUTION_MAX_STDIN_BYTES} bytes`,
        413,
        'EXECUTION_STDIN_TOO_LARGE',
      );
    }

    await this.initialize();
    if (!this.versions) {
      throw new AppError('Execution service not initialized', 500, 'EXECUTION_NOT_READY');
    }

    const mapping = LANGUAGE_MAPPINGS[request.language];
    const version = this.versions[request.language];

    const startedAt = Date.now();
    const response = await this.piston.execute({
      language: mapping.pistonLanguage,
      version,
      files: [{ name: mapping.fileName, content: request.code }],
      stdin: request.stdin,
    });
    const elapsedMs = Date.now() - startedAt;

    return this.toResult(request.language, response, elapsedMs);
  }

  private toResult(
    language: SupportedLanguage,
    response: PistonExecuteResponse,
    elapsedMs: number,
  ): ExecutionResult {
    return {
      language,
      runtime: response.runtime ?? response.language,
      version: response.version,
      stdout: response.run.stdout,
      stderr: response.run.stderr,
      exitCode: response.run.code,
      signal: response.run.signal,
      compileStderr: response.compile?.stderr?.length ? response.compile.stderr : null,
      executionTimeMs: elapsedMs,
    };
  }
}
