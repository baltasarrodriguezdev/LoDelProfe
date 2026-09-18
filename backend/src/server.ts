import { createServer } from 'node:http';
import { app } from './app.js';
import { config } from './config.js';
import { prisma } from './prisma/client.js';

const processStartedAt = performance.now();
const port = Number(process.env.PORT || 80);
const host = '0.0.0.0';

function startupLog(stage: string, details = '') {
  const elapsed = (performance.now() - processStartedAt).toFixed(1);
  console.log(`[startup] ${new Date().toISOString()} +${elapsed}ms ${stage}${details ? ` · ${details}` : ''}`);
}

startupLog('modules:ready', `node=${process.version} configured-port=${config.port}`);
const server = createServer(app);
startupLog('http:create-server');
startupLog('initialization:complete');

server.listen(port, host, () => {
  startupLog('http:listening', `host=${host} port=${port}`);
  console.log(`API lista en http://localhost:${port}`);
});
startupLog('http:listen-called');

async function stop(signal: string) {
  startupLog('shutdown:start', signal);
  server.close();
  await prisma.$disconnect();
  startupLog('shutdown:complete');
  process.exit();
}

process.on('SIGINT', () => { void stop('SIGINT'); });
process.on('SIGTERM', () => { void stop('SIGTERM'); });
