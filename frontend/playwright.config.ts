import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { defineConfig } from '@playwright/test';

import { backendUrl, E2E_BACKEND_PORT, E2E_FRONTEND_PORT, frontendUrl } from './e2e/config';

// Из-под mise PATH уже содержит нужные Java/Node, но явный mise exec сохраняет
// пины версий и при запуске npm run e2e без mise. В CI mise-action добавляет mise в PATH.
const miseFromWinget = join(
  process.env.LOCALAPPDATA ?? '',
  'Microsoft',
  'WinGet',
  'Links',
  'mise.exe',
);
const mise = process.env.MISE_EXE ?? (existsSync(miseFromWinget) ? miseFromWinget : 'mise');
const viaMise = (command: string) => `"${mise}" exec -- ${command}`;

/**
 * Настоящие React и Spring Boot поднимаются Playwright и останавливаются после
 * тестов, в том числе при падении. Ответы API не подменяются: Vite проксирует
 * /api на свежий бэкенд E2E-порта.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: frontendUrl,
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      name: 'Spring Boot (E2E)',
      command: viaMise(
        `mvn -B spring-boot:run -Dspring-boot.run.arguments=--server.port=${E2E_BACKEND_PORT}`,
      ),
      cwd: '../backend',
      url: `${backendUrl}/api/meeting-types`,
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      name: 'Vite (E2E)',
      command: viaMise(`npm run dev -- --port ${E2E_FRONTEND_PORT} --strictPort`),
      cwd: '.',
      url: `${frontendUrl}/`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { VITE_API_PROXY_TARGET: backendUrl },
    },
  ],
});
