export type WhatsappBookingRequest = {
  firstName: string;
  lastName: string;
  formattedDate: string;
  startTime: string;
  endTime: string;
  durationLabel: string;
  formattedPrice: string;
};

export function buildWhatsappBookingMessage(request: WhatsappBookingRequest) {
  return `Hola, quiero reservar un turno en Lo del Profe.

Nombre: ${request.firstName.trim()} ${request.lastName.trim()}
Día: ${request.formattedDate}
Horario: ${request.startTime} a ${request.endTime}
Duración: ${request.durationLabel}
Precio: ${request.formattedPrice}

Quedo atento/a a la confirmación.`;
}

export function buildWhatsappBookingUrl(phone: string, request: WhatsappBookingRequest) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsappBookingMessage(request))}`;
}
