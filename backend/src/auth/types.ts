export interface AuthUser {
  id: string;
  githubId: string;
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
}

export interface GithubProfile {
  githubId: string;
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
}

export interface JwtPayload {
  sub: string;
  username: string;
}
