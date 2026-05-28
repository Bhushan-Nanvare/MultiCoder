interface FrontendConfig {
  apiUrl: string;
  wsUrl: string;
}

function required(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env: FrontendConfig = {
  apiUrl: required('VITE_API_URL', import.meta.env.VITE_API_URL).replace(/\/$/, ''),
  wsUrl: required('VITE_WS_URL', import.meta.env.VITE_WS_URL),
};
