import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiListBookings } from '../sdk';
import type { Booking } from '../sdk';
import { response } from '../test/sdkMocks';
import BookingsPage from './BookingsPage';

vi.mock('../sdk', async (importOriginal) => {
  const { mockSdkModule } = await import('../test/sdkMocks');
  return mockSdkModule(importOriginal, ['apiListBookings']);
});

const url = 'http://localhost/api/bookings';

function booking(id: string, guestName: string): Booking {
  return {
    id,
    meetingTypeId: 'type-intro',
    meetingTypeName: 'Знакомство',
    start: '2026-03-11T05:00:00Z',
    end: '2026-03-11T05:30:00Z',
    guestName,
    guestEmail: `${id}@example.com`,
    createdAt: '2026-03-10T06:00:00Z',
  };
}

const initialBookings: Booking[] = [booking('booking-1', 'Иван Петров')];
const updatedBookings: Booking[] = [booking('booking-2', 'Новый Гость')];

beforeEach(() => {
  vi.mocked(apiListBookings).mockResolvedValue(response(initialBookings, url));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  cleanup();
  vi.clearAllMocks();
});

describe('Список предстоящих Записей Владельца', () => {
  it('показывает Записи из SDK с данными Гостя и временем в Asia/Almaty', async () => {
    const bookings: Booking[] = [
      booking('booking-1', 'Иван Петров'),
      {
        ...booking('booking-2', 'Анна'),
        meetingTypeId: 'type-deep',
        meetingTypeName: 'Разбор',
        start: '2026-03-12T04:00:00Z',
        end: '2026-03-12T05:00:00Z',
        createdAt: '2026-03-10T07:00:00Z',
      },
    ];
    vi.mocked(apiListBookings).mockResolvedValue(response(bookings, url));

    render(<BookingsPage />);

    expect(await screen.findByText('Иван Петров')).toBeTruthy();
    expect(apiListBookings).toHaveBeenCalledOnce();

    expect(screen.getByText('Знакомство')).toBeTruthy();
    expect(screen.getByText('booking-1@example.com')).toBeTruthy();
    expect(screen.getByText('11 марта в 10:00')).toBeTruthy();
    expect(screen.getByText('30 мин')).toBeTruthy();
    expect(screen.getByText('Создано: 10 марта в 11:00')).toBeTruthy();

    expect(screen.getByText('Разбор')).toBeTruthy();
    expect(screen.getByText('Анна')).toBeTruthy();
    expect(screen.getByText('booking-2@example.com')).toBeTruthy();
    expect(screen.getByText('12 марта в 09:00')).toBeTruthy();
    expect(screen.getByText('1 ч')).toBeTruthy();
    expect(screen.getByText('Создано: 10 марта в 12:00')).toBeTruthy();
  });

  it('обновляет список при возвращении в окно без перезагрузки страницы', async () => {
    render(<BookingsPage />);
    expect(await screen.findByText('Иван Петров')).toBeTruthy();

    vi.mocked(apiListBookings).mockResolvedValue(response(updatedBookings, url));
    fireEvent.focus(window);

    expect(await screen.findByText('Новый Гость')).toBeTruthy();
    expect(apiListBookings).toHaveBeenCalledTimes(2);
  });

  it('обновляет список при снова видимой вкладке', async () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    render(<BookingsPage />);
    expect(await screen.findByText('Иван Петров')).toBeTruthy();

    vi.mocked(apiListBookings).mockResolvedValue(response(updatedBookings, url));
    document.dispatchEvent(new Event('visibilitychange'));

    expect(await screen.findByText('Новый Гость')).toBeTruthy();
    expect(apiListBookings).toHaveBeenCalledTimes(2);
    expect(hidden).toHaveBeenCalled();
  });

  it('опрашивает API раз в 15 секунд и останавливается после размонтирования', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { unmount } = render(<BookingsPage />);
    expect(await screen.findByText('Иван Петров')).toBeTruthy();

    vi.mocked(apiListBookings).mockResolvedValue(response(updatedBookings, url));
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });

    expect(await screen.findByText('Новый Гость')).toBeTruthy();
    expect(apiListBookings).toHaveBeenCalledTimes(2);

    unmount();
    vi.mocked(apiListBookings).mockResolvedValue(response([], url));
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(apiListBookings).toHaveBeenCalledTimes(2);
  });
});
