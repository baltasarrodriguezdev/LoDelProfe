export type PhoneVerificationWhatsappRequest = {
  firstName: string;
  lastName: string;
  formattedDate: string;
  startTime: string;
  endTime: string;
  durationLabel: string;
  playersCount: number;
  formattedPrice: string;
  registeredPhone: string;
  verificationCode?: string;
};

export function buildPhoneVerificationWhatsappMessage(request: PhoneVerificationWhatsappRequest) {
  return `Hola, soy ${request.firstName.trim()} ${request.lastName.trim()}. Quiero validar mi cuenta y solicitar mi primer turno en Lo del Profe.

Datos del turno:
• Día: ${request.formattedDate}
• Horario: ${request.startTime} a ${request.endTime}
• Duración: ${request.durationLabel}
• Jugadores: ${request.playersCount}
• Precio: ${request.formattedPrice}
• Teléfono registrado: ${request.registeredPhone}
${request.verificationCode ? `• Código de validación: ${request.verificationCode}\n` : ''}

Quedo atento/a a la confirmación.`;
}

export function buildAccountVerificationWhatsappUrl(phone: string, request: { firstName: string; lastName: string; registeredPhone: string; verificationCode: string }) {
  const message = `Hola, soy ${request.firstName.trim()} ${request.lastName.trim()}. Quiero validar mi cuenta de Lo del Profe.\n\n• Teléfono registrado: ${request.registeredPhone}\n• Código de validación: ${request.verificationCode}\n\nEste mensaje fue generado por la web. Verifiquen que lo envío desde el mismo número registrado.`;
  const digits = String(phone ?? '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildPhoneVerificationWhatsappUrl(phone: string, request: PhoneVerificationWhatsappRequest) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(buildPhoneVerificationWhatsappMessage(request))}`;
}
