import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiListMeetingTypes } from '../sdk';
import type { MeetingType } from '../sdk';
import CatalogPage from './CatalogPage';

vi.mock('../sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../sdk')>();
  return {
    ...actual,
    apiListMeetingTypes: vi.fn(),
  };
});

const catalog: MeetingType[] = [
  {
    id: 'type-intro',
    name: 'Знакомство',
    description: 'Короткий созвон о вашем проекте',
    durationMinutes: 30,
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Каталог типов встреч', () => {
  it('показывает данные из ответа сгенерированного SDK', async () => {
    vi.mocked(apiListMeetingTypes).mockResolvedValue({
      data: catalog,
      error: undefined,
      request: new Request('http://localhost/api/meeting-types'),
      response: new Response(JSON.stringify(catalog), { status: 200 }),
    });

    render(
      <MemoryRouter>
        <CatalogPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 3, name: 'Знакомство' })).toBeTruthy();
    expect(screen.getByText('Короткий созвон о вашем проекте')).toBeTruthy();
    expect(screen.getByText('30 мин')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Записаться' }).getAttribute('href')).toBe(
      '/book/type-intro',
    );
  });
});
