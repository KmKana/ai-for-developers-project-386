import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
});
