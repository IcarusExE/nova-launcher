import { expect, test } from '@playwright/test';

test('desktop navigation, persistence, dialogs, and responsive layouts', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Welcome to your next adventure.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Add Brookhaven RP to favorites' }),
  ).toBeEnabled();
  await page.screenshot({ path: '/tmp/nova-home.png' });
  await page.getByRole('button', { name: 'Explore game', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Add Brookhaven RP to favorites' })
    .click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Remove Brookhaven RP from favorites' }),
  ).toBeVisible();
  await page.getByRole('button', { name: /^Library/ }).click();
  await expect(
    page.getByRole('button', { name: 'View Brookhaven RP' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'List view' }).click();
  await expect(page.locator('.game-card-list')).toHaveCount(1);
  await page.keyboard.press('Control+k');
  await expect(
    page.getByRole('textbox', { name: 'Search games' }),
  ).toBeFocused();
  await page
    .getByRole('textbox', { name: 'Search games' })
    .fill('no matching game');
  await expect(page.getByText('No games found')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'View Blade Ball' }).click();
  await expect(
    page.getByRole('heading', { name: 'Blade Ball', exact: true }),
  ).toHaveCount(2);
  await page.screenshot({ path: '/tmp/nova-discover.png' });
  for (const width of [900, 600, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const target of [
      'Home',
      'Discover',
      'Library',
      'Profile',
      'Settings',
    ]) {
      await page
        .getByRole('navigation')
        .getByRole('button', { name: new RegExp(`^${target}`) })
        .click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      expect(
        await page
          .locator('main')
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 1440, height: 940 });
  await page.getByRole('tab', { name: 'Launcher', exact: true }).click();
  await expect(page.getByText('Desktop app required')).toHaveCount(2);
  await page.screenshot({ path: '/tmp/nova-settings.png' });
  await page
    .getByRole('combobox', { name: 'Start page' })
    .selectOption('library');
  await expect(page.getByRole('combobox', { name: 'Start page' })).toHaveValue(
    'library',
  );
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Your library' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('native launch UI with simulated IPC: pending, rejection, fallback, and history', async ({
  page,
}) => {
  await page.addInitScript(() => {
    type Request = {
      action: 'launchClient' | 'openExperience';
      adapter?: string;
      placeId?: string;
    };
    const history: {
      action: string;
      adapter: string | null;
      placeId: string | null;
      acceptedAt: number;
    }[] = [];
    let rejectBrowser = true;
    const host = window as unknown as {
      isTauri: boolean;
      __TAURI_INTERNALS__: {
        invoke: (
          command: string,
          args?: { request: Request },
        ) => Promise<unknown>;
      };
    };
    host.isTauri = true;
    host.__TAURI_INTERNALS__ = {
      invoke: async (command, args) => {
        if (command === 'load_library')
          return {
            favorites: [],
            recent: [],
            preferences: {
              compactCards: false,
              reduceMotion: false,
              startPage: 'home',
              preferredAdapter: 'auto',
            },
          };
        if (command === 'load_launch_history') return [...history];
        if (command === 'detect_installations')
          return [
            {
              id: 'sober',
              name: 'Sober',
              platform: 'Linux · Flatpak',
              installation: 'detected',
              location: '/test/sober',
              detail: 'Simulated native installation for browser test',
              capabilities: { detect: true, launch: true, directJoin: false },
              runtimeVerified: true,
            },
          ];
        if (command === 'launch_request') {
          await new Promise((resolve) => setTimeout(resolve, 250));
          if (args!.request.action === 'openExperience' && rejectBrowser) {
            rejectBrowser = false;
            throw {
              code: 'dispatchFailed',
              message:
                'The default browser rejected the request. Check its installation and retry.',
            };
          }
          const request = {
            action: args!.request.action,
            adapter: args!.request.action === 'launchClient' ? 'sober' : null,
            placeId: args!.request.placeId ?? null,
            acceptedAt: Date.now(),
          };
          history.unshift(request);
          return { request, historySaved: true, warning: null };
        }
        if (command === 'reveal_main_window') return;
        if (command === 'save_library') return;
        throw new Error(`Unexpected simulated IPC: ${command}`);
      },
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Launch Roblox' }).click();
  await expect(
    page.getByRole('button', { name: 'Requesting launch…' }),
  ).toBeDisabled();
  await expect(page.getByText(/Client launch request accepted/)).toBeVisible();
  await expect(page.getByText('Sober · client request')).toBeVisible();
  await page.getByRole('button', { name: 'Explore game', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Open experience page' }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    'default browser rejected',
  );
  await dialog.getByRole('button', { name: 'Open experience page' }).click();
  await expect(
    dialog.getByText(/Nova has not confirmed game entry/),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Library', exact: true })
    .click();
  await page.getByRole('button', { name: /Recent requests/ }).click();
  await expect(page.locator('.request-row')).toHaveCount(2);
  await expect(
    page.getByText('Experience page · Place 2753915549'),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  expect(
    await page
      .locator('main')
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
});
