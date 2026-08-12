import 'dotenv/config';

const production = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET ?? 'dev-only-secret-change-me';
if (production && !process.env.JWT_SECRET) throw new Error('JWT_SECRET es obligatorio en producción');
if (production && !process.env.FRONTEND_URL) throw new Error('FRONTEND_URL es obligatorio en producción');

const frontendUrls = [
  ...(process.env.FRONTEND_URL ?? 'http://localhost:4200').split(','),
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  'https://lodelprofe.com.ar',
  'https://www.lodelprofe.com.ar',
  'https://lodelprofe.com',
  'https://www.lodelprofe.com'
].map(url => url.trim()).filter(Boolean);

export const config = {
  port: Number(process.env.PORT ?? 3000),
  production,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  authCookieName: process.env.AUTH_COOKIE_NAME ?? 'padel_session',
  csrfCookieName: process.env.CSRF_COOKIE_NAME ?? 'padel_csrf',
  authCookieMaxAgeMs: Number(process.env.AUTH_COOKIE_MAX_AGE_MS ?? 604800000),
  frontendUrls,
  publicAppUrl: (process.env.PUBLIC_APP_URL ?? frontendUrls[0]).replace(/\/$/, ''),
  passwordResetTtlMinutes: Math.max(5, Math.min(60, Number(process.env.PASSWORD_RESET_TTL_MINUTES) || 15)),
  realtime: {
    redisUrl: process.env.REALTIME_REDIS_URL ?? process.env.REDIS_URL ?? '',
    redisChannel: process.env.REALTIME_REDIS_CHANNEL ?? 'lo-del-profe:realtime:v1',
    heartbeatMs: Math.max(10_000, Number(process.env.REALTIME_HEARTBEAT_MS) || 30_000)
  },
  timezone: process.env.APP_TIMEZONE ?? 'America/Argentina/Buenos_Aires',
  businessWhatsappPhone: process.env.BUSINESS_WHATSAPP_PHONE?.replace(/\D/g, ''),
  booking: {
    slotStepMinutes: 30,
    minBookableMinutes: 60,
    pendingHoldMinutes: 10,
    avoidDeadGaps: true,
    allowAdminOverride: true
  }
};
