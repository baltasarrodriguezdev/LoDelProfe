import { DateTime } from 'luxon';
import { config } from '../config.js';

type BookingForWhatsapp = {
  id: number;
  clientName: string;
  clientPhone: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
};

const formatDate = (date: Date) => {
  const value = DateTime.fromJSDate(date, { zone: config.timezone }).setLocale('es-AR');
  return value.toFormat('cccc dd/LL');
};

const formatTime = (date: Date) => DateTime.fromJSDate(date, { zone: config.timezone }).toFormat('HH:mm');

export function buildBookingWhatsappMessage(booking: BookingForWhatsapp) {
  return [
    `Hola, soy ${booking.clientName}. Quiero confirmar mi cuenta y reservar en Lo del Profe.`,
    '',
    'Datos del turno:',
    `- Día: ${formatDate(booking.startTime)}`,
    `- Hora: ${formatTime(booking.startTime)}`,
    `- Duración: ${booking.durationMinutes} minutos`,
    `- Teléfono: ${booking.clientPhone}`,
    '',
    'Quedo atento a la confirmación.'
  ].join('\n');
}

export function buildBookingWhatsappUrl(message: string) {
  const phone = config.businessWhatsappPhone;
  if (!phone) {
    console.warn('[WhatsApp] BUSINESS_WHATSAPP_PHONE no está configurado; se devuelve reserva sin URL de WhatsApp.');
    return null;
  }
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function whatsappConfirmation(booking: BookingForWhatsapp) {
  const whatsappMessage = buildBookingWhatsappMessage(booking);
  return { whatsappMessage, whatsappUrl: buildBookingWhatsappUrl(whatsappMessage) };
}
