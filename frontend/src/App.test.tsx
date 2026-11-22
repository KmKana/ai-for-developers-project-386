import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import App from './App';

afterEach(cleanup);

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('Главная страница', () => {
  it('открывается и рассказывает о сервисе', () => {
    renderAt('/');

    expect(screen.getByRole('heading', { level: 1, name: 'Запись на звонок' })).toBeTruthy();
    expect(screen.getByText(/Упрощённый сервис бронирования времени/i)).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/');
  });

  it('ведёт на страницу записи по кнопке', () => {
    renderAt('/');

    fireEvent.click(screen.getByRole('link', { name: 'Записаться на встречу' }));

    expect(screen.getByTestId('location').textContent).toBe('/booking');
    expect(screen.getByRole('heading', { level: 1, name: 'Запись скоро' })).toBeTruthy();
  });
});
