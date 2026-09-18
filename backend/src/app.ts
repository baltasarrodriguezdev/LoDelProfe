import express, { type RequestHandler } from 'express';
import cors from 'cors';
import { config } from './config.js';
import auth from './routes/auth.routes.js';
import pub from './routes/public.routes.js';
import { errorHandler, notFound } from './middlewares/error.js';
import { csrfProtection, securityHeaders } from './middlewares/security.js';
import { HttpError } from './utils/http-error.js';

function lazyRouter(label: string, load: () => Promise<{ default: unknown }>): RequestHandler {
  let router: Promise<RequestHandler> | null = null;
  return (request, response, next) => {
    if (!router) {
      const startedAt = performance.now();
      console.log(`[lazy] ${new Date().toISOString()} ${label}:load:start`);
      router = load().then(module => {
        const direct = module.default;
        const nested = typeof direct === 'object' && direct !== null && 'default' in direct
          ? (direct as { default: unknown }).default
          : null;
        const handler = typeof direct === 'function' ? direct : nested;
        if (typeof handler !== 'function') throw new Error(`${label} no exportó un router válido.`);
        console.log(`[lazy] ${new Date().toISOString()} ${label}:load:ready · ${(performance.now() - startedAt).toFixed(1)}ms`);
        return handler as RequestHandler;
      });
    }
    void router.then(handler => handler(request, response, next)).catch(next);
  };
}

export const app = express();
app.set('trust proxy', 1);
app.use(securityHeaders, cors({ origin: config.frontendUrls, credentials: true }), express.json({ limit: '100kb' }));
app.use((request, _response, next) => {
  const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  const origin = request.headers.origin;
  if (unsafe && origin && !config.frontendUrls.includes(origin)) return next(new HttpError(403, 'Origen no autorizado'));
  next();
});
app.use(csrfProtection);

const routes = express.Router();
routes.get('/health', (_request, response) => response.json({ status: 'ok' }));
routes.use('/auth', auth);
routes.use(pub);
routes.use('/league', lazyRouter('league-public', () => import('./routes/league-public.routes.js')));
routes.use('/bookings', lazyRouter('bookings', () => import('./routes/booking.routes.js')));
routes.use('/admin/leagues', lazyRouter('league-admin', () => import('./routes/league-admin.routes.js')));
routes.use('/admin/push', lazyRouter('push', () => import('./routes/push.routes.js')));
routes.use('/admin', lazyRouter('dashboard', () => import('./routes/dashboard.routes.js')));
routes.use('/admin', lazyRouter('admin', () => import('./routes/admin.routes.js')));

app.use('/api', routes);
app.use(routes);
app.use(notFound);
app.use(errorHandler);

export default app;
