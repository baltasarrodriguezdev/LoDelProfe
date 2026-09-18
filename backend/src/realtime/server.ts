import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import type { Role } from '@prisma/client';
import { config } from '../config.js';
import { resolveAuthenticatedSession } from '../middlewares/auth.js';
import { startRealtimeBroker, subscribeRealtimeEvents, type RoutedRealtimeEvent } from './events.js';

type ClientState = {
  socket: WebSocket;
  userId?: number;
  role?: Role;
  alive: boolean;
  cookieHeader?: string;
  authorizationHeader?: string;
  lastAuthCheck: number;
};

type RealtimeRequest = IncomingMessage & {
  realtimeSession?: { userId: number; role: Role } | null;
};

const adminRoles = new Set<Role>(['ADMIN', 'SUPERADMIN']);

function canReceive(client: ClientState, event: RoutedRealtimeEvent) {
  if (event.audience === 'PUBLIC') return true;
  if (event.audience === 'ADMIN') return Boolean(client.role && adminRoles.has(client.role));
  return client.userId === event.targetUserId;
}

function wireEvent(event: RoutedRealtimeEvent) {
  return JSON.stringify({ id: event.id, type: event.type, occurredAt: event.occurredAt, resource: event.resource });
}

function reject(socket: Duplex, status: number, message: string) {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function realtimePath(request: IncomingMessage) {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  return path === '/api/realtime' || path === '/realtime';
}

export function attachRealtimeServer(server: HttpServer) {
  const websocketServer = new WebSocketServer({ noServer: true });
  const clients = new Set<ClientState>();
  const unsubscribe = subscribeRealtimeEvents(event => {
    const payload = wireEvent(event);
    for (const client of clients) {
      if (client.socket.readyState === WebSocket.OPEN && canReceive(client, event)) client.socket.send(payload);
      if (event.audience === 'USER' && client.userId === event.targetUserId
        && ['USER_UPDATED', 'USER_VERIFICATION_CHANGED'].includes(event.type)) void revalidateClient(client);
    }
  });

  async function revalidateClient(client: ClientState) {
    client.lastAuthCheck = Date.now();
    try {
      const session = await resolveAuthenticatedSession(client.cookieHeader, client.authorizationHeader);
      if (!session || session.userId !== client.userId) throw new Error('Sesión inválida');
      client.role = session.role;
    } catch {
      client.socket.close(4001, 'Sesión actualizada');
    }
  }

  websocketServer.on('connection', (socket, request) => {
    const session = (request as RealtimeRequest).realtimeSession;
    const client: ClientState = {
      socket,
      userId: session?.userId,
      role: session?.role,
      alive: true,
      cookieHeader: request.headers.cookie,
      authorizationHeader: request.headers.authorization,
      lastAuthCheck: Date.now()
    };
    clients.add(client);
    socket.on('pong', () => { client.alive = true; });
    socket.on('message', value => {
      try {
        const message = JSON.parse(String(value));
        if (message?.type === 'PING') socket.send(JSON.stringify({ type: 'PONG', occurredAt: new Date().toISOString() }));
      } catch {
        socket.close(1003, 'Mensaje inválido');
      }
    });
    socket.on('close', () => clients.delete(client));
    socket.send(JSON.stringify({
      type: 'REALTIME_CONNECTED',
      occurredAt: new Date().toISOString(),
      channels: ['availability', ...(session ? ['private'] : []), ...(session && adminRoles.has(session.role) ? ['admin'] : [])]
    }));
  });

  server.on('upgrade', async (request, socket, head) => {
    if (!realtimePath(request)) return reject(socket, 404, 'Not Found');
    const origin = request.headers.origin;
    if (origin && !config.frontendUrls.includes(origin)) return reject(socket, 403, 'Forbidden');
    try {
      let session = null;
      try {
        session = await resolveAuthenticatedSession(request.headers.cookie, request.headers.authorization);
      } catch {
        // Una cookie vencida degrada a los eventos públicos; nunca concede canales privados.
      }
      await startRealtimeBroker();
      (request as RealtimeRequest).realtimeSession = session;
      websocketServer.handleUpgrade(request, socket, head, client => {
        websocketServer.emit('connection', client, request);
      });
    } catch {
      reject(socket, 401, 'Unauthorized');
    }
  });

  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.alive) {
        client.socket.terminate();
        clients.delete(client);
        continue;
      }
      client.alive = false;
      client.socket.ping();
      if (client.userId && Date.now() - client.lastAuthCheck >= 5 * 60_000) void revalidateClient(client);
    }
  }, config.realtime.heartbeatMs);
  heartbeat.unref();

  server.once('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    for (const client of clients) client.socket.close(1001, 'Servidor detenido');
    websocketServer.close();
  });

  return { websocketServer, clients };
}
