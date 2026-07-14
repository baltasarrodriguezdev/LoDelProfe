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

Quedo atento/a a la confirmación.`;
}

export function buildPhoneVerificationWhatsappUrl(phone: string, request: PhoneVerificationWhatsappRequest) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(buildPhoneVerificationWhatsappMessage(request))}`;
}