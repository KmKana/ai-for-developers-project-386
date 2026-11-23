import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiListAvailableSlots, apiListMeetingTypes } from '../sdk';
import type { MeetingType, Slot } from '../sdk';
import BookingPage from './BookingPage';

vi.mock('../sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../sdk')>();
  return {
    ...actual,
    apiListMeetingTypes: vi.fn(),
    apiListAvailableSlots: vi.fn(),
  };
});

const types: MeetingType[] = [
  {
    id: 'type-intro',
    name: 'Знакомство',
    description: 'Короткий созвон о вашем проекте',
    durationMinutes: 30,
  },
];

const slots: Slot[] = [
  { start: '2026-03-11T09:00:00+05:00', end: '2026-03-11T09:30:00+05:00' },
  { start: '2026-03-11T10:30:00+05:00', end: '2026-03-11T11:00:00+05:00' },
];

function response<T>(data: T, url: string) {
  return {
    data,
    error: undefined,
    request: new Request(url),
    response: new Response(JSON.stringify(data), { status: 200 }),
  };
}

beforeEach(() => {
  // 10 марта 2026 года: окно записи — 11–24 марта, включая выходные 14–15 и 21–22.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-03-10T06:00:00Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Страница записи', () => {
  it('показывает дни и время из Слотов, полученных через SDK', async () => {
    vi.mocked(apiListMeetingTypes).mockResolvedValue(
      response(types, 'http://localhost/api/meeting-types'),
    );
    vi.mocked(apiListAvailableSlots).mockResolvedValue(
      response(slots, 'http://localhost/api/slots'),
    );

    render(
      <MemoryRouter initialEntries={['/book/type-intro']}>
        <Routes>
          <Route path="/book/:id" element={<BookingPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Знакомство' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: '09:00' })).toBeTruthy();
    expect(screen.getByText('11')).toBeTruthy();
    expect(screen.getByRole('button', { name: '10:30' })).toBeTruthy();
    expect(apiListAvailableSlots).toHaveBeenCalledWith({
      query: { meetingTypeId: 'type-intro' },
    });
  });

  it('показывает все 14 дней окна, включая выходные без Слотов', async () => {
    vi.mocked(apiListMeetingTypes).mockResolvedValue(
      response(types, 'http://localhost/api/meeting-types'),
    );
    vi.mocked(apiListAvailableSlots).mockResolvedValue(
      response(slots, 'http://localhost/api/slots'),
    );

    render(
      <MemoryRouter initialEntries={['/book/type-intro']}>
        <Routes>
          <Route path="/book/:id" element={<BookingPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const days = await screen.findAllByTestId('day-chip');
    expect(days).toHaveLength(14);
    expect(days[0].getAttribute('data-day')).toBe('2026-03-11');
    expect(days[13].getAttribute('data-day')).toBe('2026-03-24');

    const saturday = days.find((day) => day.getAttribute('data-day') === '2026-03-14');
    expect(saturday?.className).toContain('weekend');
    fireEvent.click(saturday!);
    expect(screen.queryAllByTestId('slot-button')).toHaveLength(0);
    expect(screen.getByText('В этот день свободных слотов нет — выберите другой день.')).toBeTruthy();
  });
});
