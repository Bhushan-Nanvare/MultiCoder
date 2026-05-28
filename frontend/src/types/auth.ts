export interface AuthUser {
  id: string;
  githubId: string;
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
}
