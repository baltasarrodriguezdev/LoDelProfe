import twilio from 'twilio';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';

type TwilioError = { code?: number | string; message?: string; status?: number };

function client() {
  const { accountSid, authToken, verifyServiceSid } = config.twilio;
  if (!accountSid || !authToken || !verifyServiceSid) {
    throw new HttpError(500, 'SMS no configurado en el servidor.');
  }
  return { api: twilio(accountSid, authToken), verifyServiceSid };
}

function logTwilioError(operation: 'send' | 'check', error: unknown) {
  const details = error && typeof error === 'object' ? error as TwilioError : {};
  const reason = details.code === 21608
    ? 'trial_recipient_not_verified'
    : details.code === 21408
      ? 'geographic_permissions'
      : details.code === 60200
        ? 'invalid_phone_number'
        : 'twilio_request_failed';
  console.error('[Twilio Verify]', {
    operation,
    reason,
    code: details.code ?? null,
    message: details.message ?? 'Unknown Twilio error',
    status: details.status ?? null
  });
}

export const smsVerification = {
  async send(phone: string) {
    try {
      const { api, verifyServiceSid } = client();
      await api.verify.v2.services(verifyServiceSid).verifications.create({ to: phone, channel: 'sms', locale: 'es' });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      logTwilioError('send', error);
      throw new HttpError(502, 'No pudimos enviar el SMS. Intentá nuevamente más tarde.');
    }
  },

  async check(phone: string, code: string) {
    try {
      const { api, verifyServiceSid } = client();
      const result = await api.verify.v2.services(verifyServiceSid).verificationChecks.create({ to: phone, code });
      return result.status === 'approved';
    } catch (error) {
      if (error instanceof HttpError) throw error;
      const details = error && typeof error === 'object' ? error as TwilioError : {};
      if (details.status === 404) return false;
      logTwilioError('check', error);
      throw new HttpError(502, 'No pudimos validar el código SMS. Intentá nuevamente.');
    }
  }
};
