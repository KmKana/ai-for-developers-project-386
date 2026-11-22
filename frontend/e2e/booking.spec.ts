import { randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext } from '@playwright/test';

import { backendUrl } from './config';

const SLOT_CONFLICT_MESSAGE = 'Выбранное время уже занято. Выберите другой слот';

interface MeetingType {
  id: string;
  name: string;
}

interface Booking {
  guestName: string;
  meetingTypeId: string;
  start: string;
}

async function createMeetingType(request: APIRequestContext, name: string): Promise<MeetingType> {
  const response = await request.post(`${backendUrl}/api/meeting-types`, {
    data: {
      name,
      description: 'E2E: проверка полного пути гостя',
      durationMinutes: 30,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as MeetingType;
}

async function createCompetingBooking(
  request: APIRequestContext,
  meetingTypeId: string,
  start: string,
  guestName: string,
): Promise<void> {
  const response = await request.post(`${backendUrl}/api/bookings`, {
    data: {
      meetingTypeId,
      start,
      guestName,
      guestEmail: `competitor-${randomUUID()}@example.com`,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
}

test('гость бронирует слот, видит конфликт с устаревшей страницей, владелец видит запись', async ({
  page,
  request,
}) => {
  const suffix = randomUUID();
  const typeName = `E2E встреча ${suffix}`;
  const guestName = `Гость ${suffix}`;
  const guestEmail = `guest-${suffix}@example.com`;
  const competitorName = `Конкурент ${suffix}`;

  const meetingType = await createMeetingType(request, typeName);

  await page.goto('/catalog');
  const card = page.getByTestId('meeting-type-card').filter({ hasText: typeName });
  await expect(card).toBeVisible();
  await card.getByTestId('book-link').click();

  // День в скользящем окне 14 дней выбирается через реальный календарь React.
  const days = page.getByTestId('day-chip');
  await expect(days.first()).toBeVisible();
  expect(await days.count()).toBeLessThanOrEqual(14);
  await days.first().click();

  const slotButtons = page.getByTestId('slot-button');
  await expect(slotButtons.first()).toBeVisible();
  const staleStart = await slotButtons.first().getAttribute('data-start');
  expect(staleStart).not.toBeNull();
  await slotButtons.first().click();
  await expect(page.getByTestId('submit-booking')).toBeEnabled();

  await page.getByTestId('guest-name').fill(guestName);
  await page.getByTestId('guest-email').fill(guestEmail);

  // Страница гостя держит устаревший список Слотов, пока другой гость бронирует
  // тот же интервал настоящим HTTP-запросом к тому же бэкенду.
  await createCompetingBooking(request, meetingType.id, staleStart as string, competitorName);

  await page.getByTestId('submit-booking').click();
  await expect(page.getByTestId('booking-conflict')).toHaveText(SLOT_CONFLICT_MESSAGE);

  const staleSlot = page.locator(`[data-testid="slot-button"][data-start="${staleStart}"]`);
  await expect(staleSlot).toHaveCount(0);

  const bookingsResponse = await request.get(`${backendUrl}/api/bookings`);
  expect(bookingsResponse.status()).toBe(200);
  const bookings = (await bookingsResponse.json()) as Booking[];
  expect(bookings).toHaveLength(1);
  expect(bookings[0].guestName).toBe(competitorName);
  expect(bookings[0].meetingTypeId).toBe(meetingType.id);
  expect(bookings[0].start).toBe(staleStart);

  // После конфликта гость может выбрать другой актуальный Слот и записаться.
  const freshSlots = page.getByTestId('slot-button');
  await expect(freshSlots.first()).toBeVisible();
  const secondStart = await freshSlots.first().getAttribute('data-start');
  expect(secondStart).not.toBe(staleStart);
  await freshSlots.first().click();
  await expect(page.getByTestId('submit-booking')).toBeEnabled();
  await page.getByTestId('submit-booking').click();

  const confirmation = page.getByTestId('booking-success');
  await expect(confirmation).toContainText('Встреча забронирована!');
  await expect(confirmation).toContainText(typeName);
  await expect(confirmation).toContainText(guestName);
  await expect(confirmation).toContainText(guestEmail);

  await page.goto('/bookings');
  const ownerRow = page.getByTestId('booking-row').filter({ hasText: guestName });
  await expect(ownerRow).toBeVisible();
  await expect(ownerRow).toContainText(typeName);
  await expect(ownerRow).toContainText(guestEmail);
});
