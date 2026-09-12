import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { parse as parseCookies } from 'cookie';
import type ShareDB from 'sharedb';
import WebSocketJSONStream from '@teamwork/websocket-json-stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { verifySessionToken } from '@/auth/jwt.js';
import { config } from '@/config/index.js';
import {
  SESSION_COOKIE_NAME,
  SHAREDB_WS_PATH,
  WS_HEARTBEAT_INTERVAL_MS,
  WS_MAX_PAYLOAD_BYTES,
} from '@/constants/index.js';
import type { ShareDbClientContext } from '@/realtime/shareDbAccess.js';
import { logger } from '@/utils/logger.js';

interface AttachOptions {
  server: HttpServer;
  backend: ShareDB;
}

function extractSessionToken(request: IncomingMessage): string | null {
  const header = request.headers.cookie;
  if (!header) return null;
  const cookies = parseCookies(header);
  const token = cookies[SESSION_COOKIE_NAME];
  return typeof token === 'string' && token.length > 0 ? token : null;
}

function clientContextFromUpgrade(request: IncomingMessage): ShareDbClientContext | 'invalid' {
  const token = extractSessionToken(request);
  if (!token) return { userId: null, username: null };
  try {
    const payload = verifySessionToken(token);
    return { userId: payload.sub, username: payload.username };
  } catch (err) {
    logger.debug({ err }, 'Rejecting WS upgrade: invalid session token');
    return 'invalid';
  }
}

/**
 * Attaches a WebSocket server for ShareDB. Authenticated sessions attach their
 * user id; clients with no cookie are allowed through as anonymous so `link-view`
 * rooms can sync. Invalid JWTs and browser origins outside CORS_ORIGINS are
 * rejected. Room ACL is enforced in ShareDB middleware.
 */
export function attachShareDbWebSocket({ server, backend }: AttachOptions): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true, maxPayload: WS_MAX_PAYLOAD_BYTES });

  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const url = request.url ?? '';
    if (!url.startsWith(SHAREDB_WS_PATH)) {
      socket.destroy();
      return;
    }

    // CORS doesn't apply to WebSocket upgrades, and the session cookie is
    // SameSite=None in production, so any site could otherwise open a socket
    // as the visitor. Browsers always send Origin; non-browser clients don't.
    const origin = request.headers.origin;
    if (origin && !config.corsOrigins.includes(origin)) {
      logger.warn({ origin }, 'Rejecting WS upgrade: origin not allowed');
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    const context = clientContextFromUpgrade(request);
    if (context === 'invalid') {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      (request as IncomingMessage & { shareDbContext: ShareDbClientContext }).shareDbContext = context;
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    const context: ShareDbClientContext =
      (request as IncomingMessage & { shareDbContext?: ShareDbClientContext }).shareDbContext ?? {
        userId: null,
        username: null,
      };
    const isAlive = { value: true };
    ws.on('pong', () => {
      isAlive.value = true;
    });

    const stream = new WebSocketJSONStream(ws);
    stream.on('error', (err) => {
      logger.warn({ err }, 'ShareDB stream error');
    });

    backend.listen(stream, context);
    logger.debug(
      { remote: request.socket.remoteAddress, url: request.url, anonymous: !context.userId },
      'ShareDB client connected',
    );

    ws.on('close', () => {
      logger.debug('ShareDB client disconnected');
    });

    const heartbeat = setInterval(() => {
      if (!isAlive.value) {
        ws.terminate();
        clearInterval(heartbeat);
        return;
      }
      isAlive.value = false;
      ws.ping();
    }, WS_HEARTBEAT_INTERVAL_MS);

    ws.on('close', () => clearInterval(heartbeat));
  });

  return wss;
}
