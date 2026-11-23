import { useEffect, useState } from 'react';

import { fetchBookings } from '../api';
import type { Booking } from '../sdk';
import { formatDateTime, formatDuration } from '../util/format';

/** Как часто список Записей проверяет новые брони без участия Владельца. */
const REFRESH_MS = 5_000;

/** Страница владельца: предстоящие встречи по всем типам. */
export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let inFlight = false;

    const refresh = async () => {
      if (inFlight) {
        return;
      }
      inFlight = true;
      try {
        const list = await fetchBookings();
        if (active) {
          setBookings(list);
          setError(null);
          setLoaded(true);
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : 'Ошибка загрузки');
          setLoaded(true);
        }
      } finally {
        inFlight = false;
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

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
