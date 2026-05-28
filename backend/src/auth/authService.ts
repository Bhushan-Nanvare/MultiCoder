import { signSessionToken } from '@/auth/jwt.js';
import type { AuthUser } from '@/auth/types.js';
import { fetchGithubProfile } from '@/auth/githubOAuth.js';
import type { UserRepository } from '@/auth/userRepository.js';

export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  async exchangeGithubCode(code: string): Promise<{ user: AuthUser; token: string }> {
    const profile = await fetchGithubProfile(code);
    const user = await this.userRepository.upsertFromGithub(profile);
    const token = signSessionToken({ sub: user.id, username: user.username });
    return { user, token };
  }

  async getUserById(id: string): Promise<AuthUser | null> {
    return this.userRepository.findById(id);
  }
}
