import {
  GoogleGenerativeAI,
  SchemaType,
  type GenerationConfig,
  type Schema,
} from '@google/generative-ai';
import { buildReviewPrompt, buildSystemInstruction } from '@/ai/promptBuilder.js';
import { reviewPayloadSchema } from '@/ai/reviewSchema.js';
import type {
  AiReviewProvider,
  ReviewRequest,
  ReviewResult,
  ReviewStreamEvent,
} from '@/ai/types.js';
import { AI_REVIEW_TIMEOUT_MS } from '@/constants/index.js';
import { AppError } from '@/utils/errors.js';

interface GeminiProviderOptions {
  apiKey: string;
  model: string;
}

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    timeComplexity: { type: SchemaType.STRING },
    spaceComplexity: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
    suggestions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    bugs: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          line: { type: SchemaType.NUMBER },
          severity: {
            type: SchemaType.STRING,
            enum: ['low', 'medium', 'high'],
            format: 'enum',
          },
          description: { type: SchemaType.STRING },
        },
        required: ['line', 'severity', 'description'],
      },
    },
    securityConcerns: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    score: { type: SchemaType.NUMBER },
  },
  required: [
    'timeComplexity',
    'spaceComplexity',
    'summary',
    'suggestions',
    'bugs',
    'securityConcerns',
    'score',
  ],
};

export class GeminiProvider implements AiReviewProvider {
  public readonly name = 'gemini';
  public readonly model: string;
  private readonly client: GoogleGenerativeAI;
  private readonly generationConfig: GenerationConfig;

  constructor(options: GeminiProviderOptions) {
    this.client = new GoogleGenerativeAI(options.apiKey);
    this.model = options.model;
    this.generationConfig = {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 8192,
    };
  }

  async review(request: ReviewRequest): Promise<ReviewResult> {
    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: buildSystemInstruction(),
      generationConfig: this.generationConfig,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_REVIEW_TIMEOUT_MS);

    try {
      const result = await model.generateContent(
        { contents: [{ role: 'user', parts: [{ text: buildReviewPrompt(request) }] }] },
        { signal: controller.signal },
      );
      return this.parseAndValidate(result.response.text());
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (controller.signal.aborted) {
        throw new AppError('AI review timed out', 504, 'AI_PROVIDER_TIMEOUT');
      }
      throw new AppError(
        `Gemini request failed: ${(err as Error).message}`,
        502,
        'AI_PROVIDER_ERROR',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async *reviewStream(
    request: ReviewRequest,
  ): AsyncGenerator<ReviewStreamEvent, void, void> {
    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: buildSystemInstruction(),
      generationConfig: this.generationConfig,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_REVIEW_TIMEOUT_MS);

    try {
      const { stream, response } = await model.generateContentStream(
        { contents: [{ role: 'user', parts: [{ text: buildReviewPrompt(request) }] }] },
        { signal: controller.signal },
      );

      let buffered = '';
      for await (const chunk of stream) {
        const text = chunk.text();
        if (!text) continue;
        buffered += text;
        yield { type: 'chunk', text };
      }

      const finalResponse = await response;
      const finalText = finalResponse.text() || buffered;
      yield { type: 'result', result: this.parseAndValidate(finalText) };
    } catch (err) {
      if (err instanceof AppError) {
        yield { type: 'error', message: err.message, code: err.code };
        return;
      }
      if (controller.signal.aborted) {
        yield { type: 'error', message: 'AI review timed out', code: 'AI_PROVIDER_TIMEOUT' };
        return;
      }
      yield {
        type: 'error',
        message: `Gemini request failed: ${(err as Error).message}`,
        code: 'AI_PROVIDER_ERROR',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseAndValidate(text: string): ReviewResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new AppError(
        `Gemini returned non-JSON (length=${text.length}): ${text.slice(0, 200)}…${text.slice(-80)}`,
        502,
        'AI_PROVIDER_BAD_RESPONSE',
        { cause: (err as Error).message, length: text.length },
      );
    }
    const validated = reviewPayloadSchema.safeParse(parsed);
    if (!validated.success) {
      throw new AppError(
        'Gemini response failed schema validation',
        502,
        'AI_PROVIDER_BAD_RESPONSE',
        { issues: validated.error.issues },
      );
    }
    return {
      ...validated.data,
      provider: this.name,
      model: this.model,
    };
  }
}
