import 'dotenv/config';

const production = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET ?? 'dev-only-secret-change-me';
if (production && !process.env.JWT_SECRET) throw new Error('JWT_SECRET es obligatorio en producción');
if (production && !process.env.FRONTEND_URL) throw new Error('FRONTEND_URL es obligatorio en producción');

const frontendUrls = [
  ...(process.env.FRONTEND_URL ?? 'http://localhost:4200').split(','),
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
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
  timezone: process.env.APP_TIMEZONE ?? 'America/Argentina/Buenos_Aires',
  businessWhatsappPhone: process.env.BUSINESS_WHATSAPP_PHONE?.replace(/\D/g, ''),
  booking: {
    slotStepMinutes: 30,
    minBookableMinutes: 60,
    avoidDeadGaps: true,
    allowAdminOverride: true
  }
};
