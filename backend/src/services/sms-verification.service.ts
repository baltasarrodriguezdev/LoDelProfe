import twilio from 'twilio';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';

function client() {
  const { accountSid, authToken, verifyServiceSid } = config.twilio;
  if (!accountSid || !authToken || !verifyServiceSid) throw new HttpError(503, 'La verificación por SMS no está configurada.');
  return { api: twilio(accountSid, authToken), verifyServiceSid };
}

export const smsVerification = {
  async send(phone: string) {
    const { api, verifyServiceSid } = client();
    try {
      await api.verify.v2.services(verifyServiceSid).verifications.create({ to: phone, channel: 'sms', locale: 'es' });
    } catch {
      throw new HttpError(502, 'No pudimos enviar el SMS. Revisá el número e intentá nuevamente.');
    }
  },
  async check(phone: string, code: string) {
    const { api, verifyServiceSid } = client();
    try {
      const result = await api.verify.v2.services(verifyServiceSid).verificationChecks.create({ to: phone, code });
      return result.status === 'approved';
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) return false;
      throw new HttpError(502, 'No pudimos validar el código SMS. Intentá nuevamente.');
    }
  }
};
