const TIME_ZONE = 'Asia/Almaty';

/** Время начала слота, например «09:30». */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

/** Части дня для чипа в календаре. */
export function dayParts(iso: string): { weekday: string; day: string; month: string } {
  const date = new Date(iso);
  return {
    weekday: new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: TIME_ZONE }).format(
      date,
    ),
    day: new Intl.DateTimeFormat('ru-RU', { day: 'numeric', timeZone: TIME_ZONE }).format(date),
    month: new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: TIME_ZONE }).format(date),
  };
}

/** Дата и время встречи для списков, например «21 ноября, 10:00». */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

/** Человекочитаемая длительность: 30 мин, 1 ч, 1 ч 15 мин. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} мин`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`;
}

/** Календарный день слота: префикс ISO-даты (слоты приходят в поясе владельца). */
export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Выходной ли календарный день (YYYY-MM-DD). */
export function isWeekend(dateStr: string): boolean {
  const [year, month, day] = dateStr.split('-').map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  return weekday === 0 || weekday === 6;
}
