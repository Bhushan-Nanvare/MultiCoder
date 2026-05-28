import { GeminiProvider } from '@/ai/geminiProvider.js';
import type { AiReviewProvider } from '@/ai/types.js';
import { config } from '@/config/index.js';

/**
 * Resolves the configured AI review provider. Adding a new provider (Ollama,
 * Groq, OpenAI) means writing one class implementing AiReviewProvider and
 * wiring it here — no route or service changes required.
 */
export function buildAiReviewProvider(): AiReviewProvider {
  switch (config.aiProvider) {
    case 'gemini':
      return new GeminiProvider({
        apiKey: config.geminiApiKey,
        model: config.geminiModel,
      });
    default: {
      // Exhaustiveness check — TS will flag if a new provider is added to the
      // union but not handled here.
      const exhaustive: never = config.aiProvider;
      throw new Error(`Unsupported AI provider: ${String(exhaustive)}`);
    }
  }
}
