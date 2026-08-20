import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Express } from 'express';

const processStartedAt = performance.now();
const port = Number(process.env.PORT || 80);
const host = '0.0.0.0';
let app: Express | null = null;
let initializationError: unknown = null;

function startupLog(stage: string, details = '') {
  const elapsed = (performance.now() - processStartedAt).toFixed(1);
  console.log(`[startup] ${new Date().toISOString()} +${elapsed}ms ${stage}${details ? ` · ${details}` : ''}`);
}

function requestPath(request: IncomingMessage) {
  return new URL(request.url ?? '/', 'http://localhost').pathname;
}

function respondJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

let resolveApplication!: () => void;
let rejectApplication!: (error: unknown) => void;
const applicationReady = new Promise<void>((resolve, reject) => {
  resolveApplication = resolve;
  rejectApplication = reject;
});
void applicationReady.catch(() => undefined);

function handleRequest(request: IncomingMessage, response: ServerResponse) {
  const path = requestPath(request);
  if (!app && (path === '/api/health' || path === '/health')) {
    return respondJson(response, initializationError ? 503 : 200, initializationError
      ? { status: 'error', phase: 'initialization' }
      : { status: 'ok' });
  }
  if (!app && (path === '/api/realtime' || path === '/realtime')) {
    return respondJson(response, 426, { message: 'Este endpoint requiere una conexión WebSocket.' });
  }
  if (app) return app(request, response);

  const timeout = setTimeout(() => {
    if (!response.headersSent) respondJson(response, 503, { message: 'La API todavía se está inicializando.' });
  }, 10_000);
  void applicationReady.then(() => {
    clearTimeout(timeout);
    if (!response.headersSent) app!(request, response);
  }).catch(() => {
    clearTimeout(timeout);
    if (!response.headersSent) respondJson(response, 503, { message: 'La API no pudo inicializarse.' });
  });
}

function rejectEarlyUpgrade(_request: IncomingMessage, socket: Duplex) {
  socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nRetry-After: 1\r\n\r\n');
  socket.destroy();
}

startupLog('process:start', `node=${process.version} host=${host} port=${port}`);
const server = createServer(handleRequest);
server.on('upgrade', rejectEarlyUpgrade);
startupLog('http:create-server');

async function initializeAfterListen() {
  try {
    startupLog('app:import:start');
    const appModule = await import('./app.js');
    app = appModule.app;
    startupLog('app:import:ready');
    resolveApplication();

    startupLog('realtime:import:start');
    const { attachRealtimeServer } = await import('./realtime/server.js');
    server.off('upgrade', rejectEarlyUpgrade);
    attachRealtimeServer(server);
    startupLog('realtime:attached');
    startupLog('initialization:complete');
  } catch (error) {
    initializationError = error;
    rejectApplication(error);
    startupLog('initialization:error', error instanceof Error ? error.message : String(error));
    console.error(error);
  }
}

server.listen(port, host, () => {
  startupLog('http:listening');
  console.log(`API lista en http://localhost:${port}`);
  void initializeAfterListen();
});
startupLog('http:listen-called');

async function stop(signal: string) {
  startupLog('shutdown:start', signal);
  server.close();
  const [{ stopRealtimeBroker }, { prisma }] = await Promise.all([
    import('./realtime/events.js'),
    import('./prisma/client.js')
  ]);
  await stopRealtimeBroker();
  await prisma.$disconnect();
  startupLog('shutdown:complete');
  process.exit();
}

process.on('SIGINT', () => { void stop('SIGINT'); });
process.on('SIGTERM', () => { void stop('SIGTERM'); });
