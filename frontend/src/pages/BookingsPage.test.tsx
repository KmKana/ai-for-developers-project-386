import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiListBookings } from '../sdk';
import type { Booking } from '../sdk';
import BookingsPage from './BookingsPage';

vi.mock('../sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../sdk')>();
  return {
    ...actual,
    apiListBookings: vi.fn(),
  };
});

const bookings: Booking[] = [
  {
    id: 'booking-1',
    meetingTypeId: 'type-intro',
    meetingTypeName: 'Знакомство',
    start: '2026-03-11T05:00:00Z',
    end: '2026-03-11T05:30:00Z',
    guestName: 'Иван Петров',
    guestEmail: 'ivan@example.com',
    createdAt: '2026-03-10T06:00:00Z',
  },
  {
    id: 'booking-2',
    meetingTypeId: 'type-deep',
    meetingTypeName: 'Разбор',
    start: '2026-03-12T04:00:00Z',
    end: '2026-03-12T05:00:00Z',
    guestName: 'Анна',
    guestEmail: 'anna@example.com',
    createdAt: '2026-03-10T07:00:00Z',
  },
];

function bookingResponse(data: Booking[]) {
  return {
    data,
    error: undefined,
    request: new Request('http://localhost/api/bookings'),
    response: new Response(JSON.stringify(data), { status: 200 }),
  };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe('Список предстоящих Записей Владельца', () => {
  it('показывает Записи из SDK с данными Гостя и временем в Asia/Almaty', async () => {
    vi.mocked(apiListBookings).mockResolvedValue({
      data: bookings,
      error: undefined,
      request: new Request('http://localhost/api/bookings'),
      response: new Response(JSON.stringify(bookings), { status: 200 }),
    });

    render(<BookingsPage />);

    expect(await screen.findByText('Иван Петров')).toBeTruthy();
    expect(apiListBookings).toHaveBeenCalledOnce();

    expect(screen.getByText('Знакомство')).toBeTruthy();
    expect(screen.getByText('ivan@example.com')).toBeTruthy();
    expect(screen.getByText('11 марта в 10:00')).toBeTruthy();
    expect(screen.getByText('30 мин')).toBeTruthy();
    expect(screen.getByText('Создано: 10 марта в 11:00')).toBeTruthy();

    expect(screen.getByText('Разбор')).toBeTruthy();
    expect(screen.getByText('Анна')).toBeTruthy();
    expect(screen.getByText('anna@example.com')).toBeTruthy();
    expect(screen.getByText('12 марта в 09:00')).toBeTruthy();
    expect(screen.getByText('1 ч')).toBeTruthy();
    expect(screen.getByText('Создано: 10 марта в 12:00')).toBeTruthy();
  });

  it('показывает новую Запись без ручного обновления страницы', async () => {
    vi.mocked(apiListBookings)
      .mockResolvedValueOnce(bookingResponse([]))
      .mockResolvedValueOnce(bookingResponse([bookings[0]]));

    render(<BookingsPage />);

    expect(await screen.findByText(/Пока нет записей/)).toBeTruthy();
    expect(apiListBookings).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(5_000);

    expect(await screen.findByText('Иван Петров')).toBeTruthy();
    expect(apiListBookings).toHaveBeenCalledTimes(2);
  });

  it('не запускает новый запрос, пока предыдущий ещё выполняется', async () => {
    let resolveFirst: (value: ReturnType<typeof bookingResponse>) => void = () => {};
    const pending = new Promise<ReturnType<typeof bookingResponse>>((resolve) => {
      resolveFirst = resolve;
    });
    vi.mocked(apiListBookings)
      .mockReturnValueOnce(pending)
      .mockResolvedValue(bookingResponse(bookings));

    render(<BookingsPage />);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(apiListBookings).toHaveBeenCalledOnce();

    resolveFirst(bookingResponse([]));
    expect(await screen.findByText(/Пока нет записей/)).toBeTruthy();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(apiListBookings).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Иван Петров')).toBeTruthy();
  });
});
