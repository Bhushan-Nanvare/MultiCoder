import {
  EXECUTION_COMPILE_TIMEOUT_MS,
  EXECUTION_RUN_TIMEOUT_MS,
} from '@/constants/index.js';
import { AppError } from '@/utils/errors.js';

interface PistonRuntime {
  language: string;
  version: string;
  aliases?: string[];
  runtime?: string;
}

interface PistonExecutePhase {
  stdout: string;
  stderr: string;
  output: string;
  code: number | null;
  signal: string | null;
  message?: string | null;
}

export interface PistonExecuteResponse {
  language: string;
  version: string;
  runtime?: string;
  run: PistonExecutePhase;
  compile?: PistonExecutePhase;
}

export interface PistonExecuteFile {
  name: string;
  content: string;
}

/**
 * Piston execute payload. `files[0]` is the entry point. Supports multi-file
 * projects (Stage 4); callers may pass a single-file array for now.
 */
export interface PistonExecuteRequest {
  language: string;
  version: string;
  files: PistonExecuteFile[];
  stdin?: string;
}

interface PistonErrorBody {
  message?: string;
}

/**
 * HTTP client for a Piston v2 API (self-hosted or emkc.org). Lists runtimes at
 * startup and executes code in an isolated sandbox.
 */
export class PistonClient {
  constructor(private readonly baseUrl: string) {}

  async listRuntimes(): Promise<PistonRuntime[]> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/runtimes`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new AppError(
        `Piston runtimes unavailable at ${url}: ${message}`,
        502,
        'EXECUTION_PROVIDER_UNAVAILABLE',
      );
    }

    if (!response.ok) {
      throw new AppError(
        `Piston runtimes request failed (${response.status})`,
        502,
        'EXECUTION_PROVIDER_UNAVAILABLE',
      );
    }

    const data = (await response.json()) as PistonRuntime[];
    if (!Array.isArray(data) || data.length === 0) {
      throw new AppError(
        'Piston returned no runtimes — is the piston container running?',
        502,
        'EXECUTION_PROVIDER_UNAVAILABLE',
      );
    }
    return data;
  }

  async execute(request: PistonExecuteRequest): Promise<PistonExecuteResponse> {
    if (request.files.length === 0) {
      throw new AppError('At least one file is required', 400, 'VALIDATION_FAILED');
    }

    const url = `${this.baseUrl.replace(/\/$/, '')}/execute`;
    const body = {
      language: request.language,
      version: request.version,
      files: request.files.map((file) => ({
        name: file.name,
        content: file.content,
      })),
      stdin: request.stdin ?? '',
      compile_timeout: EXECUTION_COMPILE_TIMEOUT_MS,
      run_timeout: EXECUTION_RUN_TIMEOUT_MS,
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new AppError(
        `Piston execute unavailable at ${url}: ${message}`,
        502,
        'EXECUTION_PROVIDER_UNAVAILABLE',
      );
    }

    if (response.status === 429) {
      throw new AppError(
        'Code execution rate limited upstream — try again shortly',
        429,
        'EXECUTION_UPSTREAM_RATE_LIMITED',
      );
    }

    if (!response.ok) {
      let detail = '';
      try {
        const errorBody = (await response.json()) as PistonErrorBody;
        detail = errorBody.message ?? '';
      } catch {
        // ignore parse failure
      }
      throw new AppError(
        `Piston execute failed (${response.status})${detail ? `: ${detail}` : ''}`,
        502,
        'EXECUTION_PROVIDER_ERROR',
      );
    }

    return (await response.json()) as PistonExecuteResponse;
  }
}
