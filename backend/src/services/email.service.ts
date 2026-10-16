import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const localMailbox: EmailMessage[] = [];

export function assertEmailDeliveryConfigured() {
  if (!config.email.configured) {
    throw new HttpError(503, 'El envío de email todavía no está configurado.', 'EMAIL_NOT_CONFIGURED');
  }
}

export async function sendEmail(message: EmailMessage) {
  assertEmailDeliveryConfigured();
  if (config.email.provider === 'local' && !config.production) {
    localMailbox.push(structuredClone(message));
    return;
  }

  let response: Response;
  try {
    response = await fetch(config.email.apiUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.email.apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ from: config.email.from, ...message }),
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw new HttpError(503, 'No pudimos enviar el email. IntentÃ¡ nuevamente mÃ¡s tarde.', 'EMAIL_DELIVERY_FAILED');
  }
  if (!response.ok) {
    throw new HttpError(503, 'No pudimos enviar el email. Intentá nuevamente más tarde.', 'EMAIL_DELIVERY_FAILED');
  }
}

export function drainLocalMailbox() {
  if (config.production) return [];
  return localMailbox.splice(0, localMailbox.length);
}

export function peekLocalMailbox() {
  if (config.production) return [];
  return localMailbox.map(message => structuredClone(message));
}
