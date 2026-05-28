import { EXECUTION_RUN_TIMEOUT_MS } from '@/constants/index.js';
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
}

export interface PistonExecuteResponse {
  language: string;
  version: string;
  runtime?: string;
  run: PistonExecutePhase;
  compile?: PistonExecutePhase;
}

export interface PistonExecuteRequest {
  language: string;
  version: string;
  file: { name: string; content: string };
  stdin?: string;
}

interface CodexResponse {
  output?: string;
  error?: string;
  language?: string;
  info?: string;
  status?: number;
}

const CODEX_ENDPOINTS = ['https://api.codex.jaagrav.in', 'https://codex-api.fly.dev'];

const CODEX_LANGUAGE: Record<string, string> = {
  javascript: 'js',
  python: 'py',
  cpp: 'cpp',
};

const STATIC_RUNTIMES: PistonRuntime[] = [
  { language: 'javascript', version: '16.20.2' },
  { language: 'python', version: '3.6.9' },
  { language: 'cpp', version: '7.5.0' },
];

export class PistonClient {
  constructor(private readonly endpoints: string[] = CODEX_ENDPOINTS) {}

  async listRuntimes(): Promise<PistonRuntime[]> {
    return STATIC_RUNTIMES;
  }

  async execute(request: PistonExecuteRequest): Promise<PistonExecuteResponse> {
    const language = CODEX_LANGUAGE[request.language];
    if (!language) {
      throw new AppError(
        `Unsupported execution language "${request.language}"`,
        400,
        'EXECUTION_LANGUAGE_UNSUPPORTED',
      );
    }

    const payload = JSON.stringify({
      code: request.file.content,
      language,
      input: request.stdin ?? '',
    });

    let lastError = '';
    for (const endpoint of this.endpoints) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), EXECUTION_RUN_TIMEOUT_MS + 10_000);
        let response: Response;
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: payload,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }

        if (response.status === 429) {
          throw new AppError(
            'Code execution rate limited upstream — try again shortly',
            429,
            'EXECUTION_UPSTREAM_RATE_LIMITED',
          );
        }
        if (!response.ok) {
          lastError = `${endpoint} responded ${response.status}`;
          continue;
        }

        const data = (await response.json()) as CodexResponse;
        const stdout = data.output ?? '';
        const stderr = data.error ?? '';
        return {
          language: request.language,
          version: request.version,
          runtime: (data.info ?? '').split('\n')[0]?.trim() || request.language,
          run: {
            stdout,
            stderr,
            output: `${stdout}${stderr}`,
            code: stderr.length > 0 ? 1 : 0,
            signal: null,
          },
        };
      } catch (err) {
        if (err instanceof AppError) throw err;
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    throw new AppError(
      `Code execution provider unavailable: ${lastError.slice(0, 200)}`,
      502,
      'EXECUTION_PROVIDER_UNAVAILABLE',
    );
  }
}
