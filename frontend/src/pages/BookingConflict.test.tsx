import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiCreateBooking, apiListAvailableSlots, apiListMeetingTypes } from '../sdk';
import type { ApiError, MeetingType, Slot } from '../sdk';
import BookingPage from './BookingPage';

const FALLBACK_MESSAGE = 'Что-то пошло не так. Попробуйте ещё раз.';
const SLOT_CONFLICT_MESSAGE = 'Выбранное время уже занято. Выберите другой слот';

vi.mock('../sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../sdk')>();
  return {
    ...actual,
    apiListMeetingTypes: vi.fn(),
    apiListAvailableSlots: vi.fn(),
    apiCreateBooking: vi.fn(),
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

function failure(code: string, message: string) {
  const body: ApiError = { code: code as ApiError['code'], message };
  return {
    data: undefined,
    error: body,
    request: new Request('http://localhost/api/bookings', { method: 'POST' }),
    response: new Response(JSON.stringify(body), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    }),
  };
}

function mockSlotPages(...pages: Slot[][]) {
  const mocked = vi.mocked(apiListAvailableSlots);
  mocked.mockReset();
  for (const page of pages) {
    mocked.mockResolvedValueOnce(response(page, 'http://localhost/api/slots'));
  }
  mocked.mockResolvedValue(response(pages[pages.length - 1] ?? [], 'http://localhost/api/slots'));
}

async function chooseSlotAndSubmit() {
  expect(await screen.findByRole('heading', { name: 'Знакомство' })).toBeTruthy();
  // День выбирается эффектом после первого рендера — ждём появления кнопки времени.
  fireEvent.click(await screen.findByRole('button', { name: '09:00' }));
  fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Гость' } });
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'guest@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Подтвердить запись/ }));
}

function renderBookingPage() {
  render(
    <MemoryRouter initialEntries={['/book/type-intro']}>
      <Routes>
        <Route path="/book/:id" element={<BookingPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(apiListMeetingTypes).mockResolvedValue(
    response(types, 'http://localhost/api/meeting-types'),
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Обработка конфликтов на Странице записи', () => {
  it('SLOT_CONFLICT: показывает сообщение сервера и перезагружает Слоты', async () => {
    mockSlotPages(slots, [slots[1]]);
    vi.mocked(apiCreateBooking).mockResolvedValue(
      failure('SLOT_CONFLICT', SLOT_CONFLICT_MESSAGE) as never,
    );

    renderBookingPage();
    await chooseSlotAndSubmit();

    expect(await screen.findByText(SLOT_CONFLICT_MESSAGE)).toBeTruthy();
    await waitFor(() => {
      expect(apiListAvailableSlots).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('button', { name: '09:00' })).toBeNull();
      expect(screen.getByRole('button', { name: '10:30' })).toBeTruthy();
    });
  });

  it.each([
    {
      code: 'OFF_GRID',
      message: 'Начало встречи должно быть на 30-минутной сетке. Выберите другое время.',
    },
    {
      code: 'OUTSIDE_WORKING_HOURS',
      message: 'Встреча должна проходить в рабочие дни с 09:00 до 18:00 по времени владельца.',
    },
    {
      code: 'OUT_OF_WINDOW',
      message: 'Запись доступна на ближайшие 14 дней. Выберите другую дату.',
    },
  ])('$code: показывает сообщение сервера и обновляет Слоты', async ({ code, message }) => {
    mockSlotPages(slots, slots);
    vi.mocked(apiCreateBooking).mockResolvedValue(failure(code, message) as never);

    renderBookingPage();
    await chooseSlotAndSubmit();

    expect(await screen.findByText(message)).toBeTruthy();
    await waitFor(() => expect(apiListAvailableSlots).toHaveBeenCalledTimes(2));
  });

  it('неизвестный код показывает универсальный текст вместо служебного сообщения', async () => {
    mockSlotPages(slots);
    vi.mocked(apiCreateBooking).mockResolvedValue(
      failure('UNEXPECTED_CODE', 'Служебная информация') as never,
    );

    renderBookingPage();
    await chooseSlotAndSubmit();

    expect(await screen.findByText(FALLBACK_MESSAGE)).toBeTruthy();
    expect(screen.queryByText('Служебная информация')).toBeNull();
  });
});
