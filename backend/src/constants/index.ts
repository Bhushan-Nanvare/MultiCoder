export const ROOM_ID_LENGTH = 10;

export const SHAREDB_COLLECTION = 'rooms';

export const SHAREDB_WS_PATH = '/sharedb';

export const DEFAULT_ROOM_LANGUAGE = 'javascript';

export const SUPPORTED_LANGUAGES = ['javascript', 'python', 'cpp'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const HTTP_BODY_LIMIT = '256kb';

export const WS_HEARTBEAT_INTERVAL_MS = 30_000;

export const SESSION_COOKIE_NAME = 'multicoder_session';

export const OAUTH_STATE_COOKIE_NAME = 'multicoder_oauth_state';

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const SESSION_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// --- Code execution (Piston) ---
export const PISTON_BASE_URL = 'https://emkc.org/api/v2/piston';
export const EXECUTION_RUN_TIMEOUT_MS = 5_000;
export const EXECUTION_COMPILE_TIMEOUT_MS = 10_000;
export const EXECUTION_MAX_CODE_BYTES = 64 * 1024; // 64 KB source
export const EXECUTION_MAX_STDIN_BYTES = 8 * 1024;

// --- Rate limiting ---
export const EXECUTION_RATE_LIMIT_MAX = 10;
export const EXECUTION_RATE_LIMIT_WINDOW_MS = 60 * 1000;

// --- AI review ---
export const AI_REVIEW_RATE_LIMIT_MAX = 5;
export const AI_REVIEW_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const AI_REVIEW_MAX_CODE_BYTES = 32 * 1024;
export const AI_REVIEW_TIMEOUT_MS = 30_000;

// --- Snapshots / room history ---
export const SNAPSHOT_MAX_PER_ROOM = 50;
export const SNAPSHOT_MAX_CONTENT_BYTES = 256 * 1024;
export const SNAPSHOT_RATE_LIMIT_MAX = 30;
export const SNAPSHOT_RATE_LIMIT_WINDOW_MS = 60 * 1000;

// --- Plagiarism detection (winnowing) ---
export const PLAGIARISM_KGRAM_SIZE = 5;
export const PLAGIARISM_WINDOW_SIZE = 4;
export const PLAGIARISM_MAX_CODE_BYTES = 32 * 1024;
export const PLAGIARISM_MAX_MATCHES_RETURNED = 5;
export const PLAGIARISM_RATE_LIMIT_MAX = 20;
export const PLAGIARISM_RATE_LIMIT_WINDOW_MS = 60 * 1000;
