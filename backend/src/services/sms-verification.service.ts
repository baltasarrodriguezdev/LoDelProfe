import { HttpError } from '../utils/http-error.js';

/** @deprecated SMS/Twilio Verify ya no se usa. El flujo vigente valida por WhatsApp + aprobación admin. */
export const smsVerification = {
  async send() {
    throw new HttpError(410, 'La verificación por SMS ya no está disponible.');
  },
  async check() {
    throw new HttpError(410, 'La verificación por SMS ya no está disponible.');
  }
};
