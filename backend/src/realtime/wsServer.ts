import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { parse as parseCookies } from 'cookie';
import type ShareDB from 'sharedb';
import WebSocketJSONStream from '@teamwork/websocket-json-stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { verifySessionToken } from '@/auth/jwt.js';
import {
  SESSION_COOKIE_NAME,
  SHAREDB_WS_PATH,
  WS_HEARTBEAT_INTERVAL_MS,
} from '@/constants/index.js';
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

/**
 * Attaches a WebSocket server to the given HTTP server for ShareDB traffic.
 * Verifies the session JWT cookie on upgrade and rejects unauthenticated
 * clients before any ShareDB traffic flows. Heartbeat terminates stale sockets
 * so sessions don't leak when clients disappear without a close frame.
 */
export function attachShareDbWebSocket({ server, backend }: AttachOptions): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const url = request.url ?? '';
    if (!url.startsWith(SHAREDB_WS_PATH)) {
      socket.destroy();
      return;
    }

    const token = extractSessionToken(request);
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    try {
      verifySessionToken(token);
    } catch (err) {
      logger.debug({ err }, 'Rejecting WS upgrade: invalid session token');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws: WebSocket, request) => {
    const isAlive = { value: true };
    ws.on('pong', () => {
      isAlive.value = true;
    });

    const stream = new WebSocketJSONStream(ws);
    stream.on('error', (err) => {
      logger.warn({ err }, 'ShareDB stream error');
    });

    backend.listen(stream);
    logger.debug(
      { remote: request.socket.remoteAddress, url: request.url },
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
