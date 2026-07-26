import { DateTime } from 'luxon';
import { config } from '../config.js';
import { HttpError } from './http-error.js';

export const localDateTime = (date: string, time: string) => {
  const value = DateTime.fromISO(`${date}T${time}`, { zone: config.timezone });
  if (!value.isValid) throw new HttpError(400, 'Fecha u hora inválida');
  return value;
};

export const dayOfWeek = (date: string) => DateTime.fromISO(date, { zone: config.timezone }).weekday % 7;

export const bounds = (date: string, openTime: string, closeTime: string) => {
  const open = localDateTime(date, openTime);
  let close = localDateTime(date, closeTime);
  if (close <= open) close = close.plus({ days: 1 });
  return { open, close };
};

export type BusinessInterval = { open: DateTime; close: DateTime };

export const businessIntervals = (
  date: string,
  openTime: string,
  closeTime: string,
  breakStartTime?: string | null,
  breakEndTime?: string | null
): BusinessInterval[] => {
  const schedule = bounds(date, openTime, closeTime);
  if (!breakStartTime || !breakEndTime) return [schedule];

  let breakStart = localDateTime(date, breakStartTime);
  let breakEnd = localDateTime(date, breakEndTime);
  if (breakStart < schedule.open) breakStart = breakStart.plus({ days: 1 });
  if (breakEnd <= breakStart) breakEnd = breakEnd.plus({ days: 1 });
  if (breakStart <= schedule.open || breakEnd >= schedule.close) {
    throw new HttpError(400, 'El descanso debe quedar dentro del horario de apertura');
  }
  return [
    { open: schedule.open, close: breakStart },
    { open: breakEnd, close: schedule.close }
  ];
};
