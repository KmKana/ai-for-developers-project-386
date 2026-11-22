import {
  apiCreateBooking,
  apiCreateMeetingType,
  apiListAvailableSlots,
  apiListBookings,
  apiListMeetingTypes,
} from './sdk';
import { client } from './sdk/client.gen';

import type {
  ApiError,
  Booking,
  BookingInput,
  MeetingType,
  MeetingTypeInput,
  Slot,
} from './sdk/types.gen';

// Фронтенд общается с API по тому же origin: в dev это прокси Vite,
// в проде — тот же сервер. Абсолютный адрес из контракта не нужен.
client.setConfig({ baseUrl: '' });

/** Все коды контракта: только их сообщения можно показывать пользователю. */
const KNOWN_CODES = new Set<ApiError['code']>([
  'VALIDATION_ERROR',
  'MEETING_TYPE_NOT_FOUND',
  'SLOT_CONFLICT',
  'OFF_GRID',
  'OUTSIDE_WORKING_HOURS',
  'OUT_OF_WINDOW',
]);

/** Коды 409-ответов: время недоступно, нужно обновить Слоты. */
const CONFLICT_CODES = new Set<ApiError['code']>([
  'SLOT_CONFLICT',
  'OFF_GRID',
  'OUTSIDE_WORKING_HOURS',
  'OUT_OF_WINDOW',
]);

/** Форма ошибки берётся из сгенерированного SDK, а не описывается вручную. */
type ApiFailure = Partial<ApiError>;

/** Ошибка вызова API с кодом из контракта. */
export class ApiCallError extends Error {
  readonly code?: ApiError['code'];

  constructor(failure?: ApiFailure | null) {
    super(failureMessage(failure));
    this.code = failure?.code;
  }
}

/** Сценарий выбирается по коду: служебный текст неизвестного кода не показываем. */
export function failureMessage(failure?: ApiFailure | null): string {
  if (failure?.code && KNOWN_CODES.has(failure.code) && failure.message) {
    return failure.message;
  }
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}

/** Время недоступно (занято, вне сетки/окна/рабочих часов) — это 409. */
export function isConflict(error: unknown): boolean {
  return error instanceof ApiCallError && !!error.code && CONFLICT_CODES.has(error.code);
}

export async function fetchMeetingTypes(): Promise<MeetingType[]> {
  const { data, error } = await apiListMeetingTypes();
  if (error) {
    throw new ApiCallError(error);
  }
  return data ?? [];
}

export async function createMeetingType(input: MeetingTypeInput): Promise<MeetingType> {
  const { data, error } = await apiCreateMeetingType({ body: input });
  if (error) {
    throw new ApiCallError(error);
  }
  if (data === undefined) {
    throw new ApiCallError(null);
  }
  return data;
}

export async function fetchSlots(meetingTypeId: string): Promise<Slot[]> {
  const { data, error } = await apiListAvailableSlots({ query: { meetingTypeId } });
  if (error) {
    throw new ApiCallError(error);
  }
  return data ?? [];
}

export async function createBooking(input: BookingInput): Promise<Booking> {
  const { data, error } = await apiCreateBooking({ body: input });
  if (error) {
    throw new ApiCallError(error);
  }
  if (data === undefined) {
    throw new ApiCallError(null);
  }
  return data;
}

export async function fetchBookings(): Promise<Booking[]> {
  const { data, error } = await apiListBookings();
  if (error) {
    throw new ApiCallError(error);
  }
  return data ?? [];
}
