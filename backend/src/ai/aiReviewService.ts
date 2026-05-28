import type {
  AiReviewProvider,
  ReviewRequest,
  ReviewResult,
  ReviewStreamEvent,
} from '@/ai/types.js';
import { AI_REVIEW_MAX_CODE_BYTES } from '@/constants/index.js';
import { AppError } from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';

export class AiReviewService {
  constructor(private readonly provider: AiReviewProvider) {}

  async review(request: ReviewRequest): Promise<ReviewResult> {
    this.validateRequest(request);
    const startedAt = Date.now();
    const result = await this.provider.review(request);
    logger.info(
      {
        provider: result.provider,
        model: result.model,
        elapsedMs: Date.now() - startedAt,
        language: request.language,
        score: result.score,
      },
      'AI review completed',
    );
    return result;
  }

  async *reviewStream(
    request: ReviewRequest,
  ): AsyncGenerator<ReviewStreamEvent, void, void> {
    this.validateRequest(request);
    const startedAt = Date.now();
    let chunkCount = 0;
    let charCount = 0;
    let finalResult: ReviewResult | null = null;

    for await (const event of this.provider.reviewStream(request)) {
      if (event.type === 'chunk') {
        chunkCount += 1;
        charCount += event.text.length;
      } else if (event.type === 'result') {
        finalResult = event.result;
      }
      yield event;
    }

    if (finalResult) {
      logger.info(
        {
          provider: finalResult.provider,
          model: finalResult.model,
          elapsedMs: Date.now() - startedAt,
          chunks: chunkCount,
          chars: charCount,
          language: request.language,
          score: finalResult.score,
        },
        'AI review (stream) completed',
      );
    }
  }

  private validateRequest(request: ReviewRequest): void {
    if (Buffer.byteLength(request.code, 'utf8') > AI_REVIEW_MAX_CODE_BYTES) {
      throw new AppError(
        `Code exceeds AI review limit of ${AI_REVIEW_MAX_CODE_BYTES} bytes`,
        413,
        'AI_REVIEW_CODE_TOO_LARGE',
      );
    }
    if (request.code.trim().length === 0) {
      throw new AppError('Cannot review empty code', 400, 'AI_REVIEW_EMPTY_CODE');
    }
  }
}
