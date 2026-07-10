const ERROR_MESSAGE = 'Ingresá un teléfono argentino válido, por ejemplo 3515551234.';

export function normalizeArgentinaPhone(input: string): string | null {
  let digits = String(input ?? '').replace(/\D/g, '');
  const hadCountryCode = digits.startsWith('54');
  if (hadCountryCode) digits = digits.slice(2);
  if (digits.startsWith('9') && (hadCountryCode || digits.length === 11)) digits = digits.slice(1);
  if (digits.startsWith('0')) digits = digits.slice(1);

  // Formato nacional antiguo: 0 + característica + 15 + número de abonado.
  if (digits.length === 12) {
    const candidates = [2, 3, 4]
      .filter(position => digits.slice(position, position + 2) === '15')
      .map(position => digits.slice(0, position) + digits.slice(position + 2));
    if (candidates.length === 1) digits = candidates[0];
  }

  return /^\d{10}$/.test(digits) ? `+54${digits}` : null;
}

export const ARGENTINA_PHONE_ERROR = ERROR_MESSAGE;

export function localArgentinaPhone(e164Phone: string) {
  return e164Phone.replace(/^\+?549?/, '');
}

export function storedPhoneCandidates(e164Phone: string) {
  const local = localArgentinaPhone(e164Phone);
  const current = `54${local}`;
  const legacyMobile = `549${local}`;
  return Array.from(new Set([local, `+${current}`, current, `+${legacyMobile}`, legacyMobile]));
}
