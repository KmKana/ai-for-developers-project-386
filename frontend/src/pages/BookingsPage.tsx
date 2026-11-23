import { useCallback, useEffect, useState } from 'react';

import { fetchBookings } from '../api';
import type { Booking } from '../sdk';
import { formatDateTime, formatDuration } from '../util/format';

/** Интервал обновления списка Владельца без перезагрузки страницы. */
const REFRESH_MS = 15_000;

/** Страница владельца: предстоящие встречи по всем типам. */
export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await fetchBookings();
      setBookings(list);
      setError(null);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить записи');
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const onFocus = () => void refresh();
    const onVisibilityChange = () => {
      if (!document.hidden) {
        void refresh();
      }
    };
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh]);

  return (
    <div className="page">
      <h1>Предстоящие встречи</h1>
      <p className="muted">Записи гостей по всем типам встреч, отсортированы по времени.</p>

      {error && <div className="banner banner-error">{error}</div>}

      {loaded && !error && bookings.length === 0 && (
        <div className="empty">
          Пока нет записей. Когда гость забронирует слот, встреча появится здесь.
        </div>
      )}

      <div className="type-list">
        {bookings.map((booking) => (
          <article key={booking.id} className="booking-row" data-testid="booking-row">
            <div className="booking-when">
              <strong>{formatDateTime(booking.start)}</strong>
              <span className="muted small">
                {formatDuration(
                  Math.round(
                    (new Date(booking.end).getTime() - new Date(booking.start).getTime()) / 60000,
                  ),
                )}
              </span>
              <span className="muted small">Создано: {formatDateTime(booking.createdAt)}</span>
            </div>
            <div className="booking-who">
              <span className="chip">{booking.meetingTypeName}</span>
              <strong>{booking.guestName}</strong>
              <span className="muted small">{booking.guestEmail}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
