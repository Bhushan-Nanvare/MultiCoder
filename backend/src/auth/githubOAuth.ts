import { randomBytes } from 'node:crypto';
import { config } from '@/config/index.js';
import type { GithubProfile } from '@/auth/types.js';
import { AppError } from '@/utils/errors.js';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails';

const OAUTH_SCOPE = 'read:user user:email';

export function generateOAuthState(): string {
  return randomBytes(24).toString('hex');
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.githubClientId,
    redirect_uri: config.oauthCallbackUrl,
    scope: OAUTH_SCOPE,
    state,
    allow_signup: 'true',
  });
  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      code,
      redirect_uri: config.oauthCallbackUrl,
    }),
  });
  if (!response.ok) {
    throw new AppError(
      `GitHub token exchange failed (${response.status})`,
      502,
      'OAUTH_EXCHANGE_FAILED',
    );
  }
  const body = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!body.access_token) {
    throw new AppError(
      body.error_description ?? body.error ?? 'GitHub did not return an access token',
      502,
      'OAUTH_EXCHANGE_FAILED',
    );
  }
  return body.access_token;
}

interface GithubUserResponse {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface GithubEmailRecord {
  email: string;
  primary: boolean;
  verified: boolean;
}

async function fetchPrimaryEmail(token: string): Promise<string | null> {
  const response = await fetch(GITHUB_EMAILS_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'multicoder',
    },
  });
  if (!response.ok) {
    return null;
  }
  const emails = (await response.json()) as GithubEmailRecord[];
  const primary = emails.find((entry) => entry.primary && entry.verified);
  return primary?.email ?? null;
}

export async function fetchGithubProfile(code: string): Promise<GithubProfile> {
  const token = await exchangeCodeForToken(code);

  const userRes = await fetch(GITHUB_USER_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'multicoder',
    },
  });
  if (!userRes.ok) {
    throw new AppError(
      `GitHub /user request failed (${userRes.status})`,
      502,
      'OAUTH_PROFILE_FAILED',
    );
  }
  const profile = (await userRes.json()) as GithubUserResponse;

  let email = profile.email;
  if (!email) {
    email = await fetchPrimaryEmail(token);
  }

  return {
    githubId: String(profile.id),
    username: profile.login,
    displayName: profile.name?.trim() || profile.login,
    email,
    avatarUrl: profile.avatar_url,
  };
}
