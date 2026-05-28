/**
 * Minimal Server-Sent Events parser that consumes an HTTP response body and
 * yields `{event, data}` records as soon as each `\n\n`-terminated SSE frame
 * arrives. Avoids the EventSource API so we can use POST with credentials.
 */
export interface SseFrame {
  event: string;
  data: string;
}

export async function* readSseFrames(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<SseFrame, void, void> {
  if (!response.body) {
    throw new Error('Response has no body');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const onAbort = (): void => {
    reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener('abort', onAbort);

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let separatorIdx: number;
      while ((separatorIdx = buffer.indexOf('\n\n')) !== -1) {
        const rawFrame = buffer.slice(0, separatorIdx);
        buffer = buffer.slice(separatorIdx + 2);
        const frame = parseFrame(rawFrame);
        if (frame) yield frame;
      }
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}

function parseFrame(raw: string): SseFrame | null {
  const lines = raw.split('\n');
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith(':') || line.length === 0) continue;
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
    }
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}
