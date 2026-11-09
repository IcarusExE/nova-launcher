import { expect, test, type Page } from '@playwright/test';
import { defaultLibrary } from '../src/lib/storage';

async function settings(page: Page) {
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  await expect(
    page.getByRole('combobox', { name: 'Color theme' }),
  ).toBeEnabled();
}
async function nativeStorage(page: Page, delay = 250) {
  await page.addInitScript(
    ({ defaults, delay }) => {
      const host = window as unknown as {
        isTauri: boolean;
        __TAURI_INTERNALS__: {
          invoke: (
            command: string,
            args?: { data?: typeof defaults; theme?: string },
          ) => Promise<unknown>;
        };
        settingsTest: {
          delay: number;
          failNext: boolean;
          writes: number;
          concurrent: number;
          maxConcurrent: number;
          reveal: unknown;
        };
      };
      host.isTauri = true;
      const control: typeof host.settingsTest = (host.settingsTest = {
        delay,
        failNext: false,
        writes: 0,
        concurrent: 0,
        maxConcurrent: 0,
        reveal: null,
      });
      host.__TAURI_INTERNALS__ = {
        invoke: async (command, args) => {
          if (command === 'load_library') {
            await new Promise((resolve) => setTimeout(resolve, delay));
            return JSON.parse(
              localStorage.getItem('settings-native-test') ??
                JSON.stringify(defaults),
            );
          }
          if (
            command === 'detect_installations' ||
            command === 'load_launch_history'
          )
            return [];
          if (command === 'reveal_main_window') {
            control.reveal = {
              theme: args?.theme,
              applied: document.documentElement.dataset.theme,
              ready: !document.querySelector('.appearance-pending'),
            };
            return;
          }
          if (command === 'save_library') {
            control.writes++;
            control.concurrent++;
            control.maxConcurrent = Math.max(
              control.maxConcurrent,
              control.concurrent,
            );
            const fail = control.failNext;
            control.failNext = false;
            const data = JSON.stringify(args?.data);
            try {
              await new Promise((resolve) =>
                setTimeout(resolve, control.delay),
              );
              if (fail)
                throw new Error(
                  'Preferences are read-only. Check database permissions and retry.',
                );
              localStorage.setItem('settings-native-test', data);
            } finally {
              control.concurrent--;
            }
            return;
          }
          throw new Error(`Unexpected test IPC: ${command}`);
        },
      };
    },
    { defaults: structuredClone(defaultLibrary), delay },
  );
}

test('themes and accessible accents apply across pages, follow system changes, and survive browser restart', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await settings(page);
  const theme = page.getByRole('combobox', { name: 'Color theme' });
  await expect(theme).toHaveValue('dark');
  await expect(page.getByRole('radio', { name: 'Nova Violet' })).toBeChecked();
  for (const palette of ['dark', 'light']) {
    await theme.selectOption(palette);
    await expect(page.locator('html')).toHaveAttribute('data-theme', palette);
    for (const accent of ['Nova Violet', 'Blue', 'Teal', 'Amber']) {
      await page.getByRole('radio', { name: accent, exact: true }).click();
      await expect(
        page.getByRole('radio', { name: accent, exact: true }),
      ).toBeChecked();
      // Check actual rendered token colors for primary controls, accent surfaces,
      // and secondary copy in every theme/accent combination.
      const contrast = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d')!;
        function luminance(variable: string) {
          const el = document.createElement('span');
          el.style.color = `var(${variable})`;
          document.body.append(el);
          ctx.fillStyle = getComputedStyle(el).color;
          ctx.fillRect(0, 0, 1, 1);
          el.remove();
          const [r, g, b] = [...ctx.getImageData(0, 0, 1, 1).data].map((x) => {
            const value = x / 255;
            return value <= 0.04045
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }
        function ratio(a: string, b: string) {
          const x = luminance(a),
            y = luminance(b);
          return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
        }
        return [
          ratio('--on-accent', '--accent'),
          ratio('--accent-text', '--accent-surface'),
          ratio('--muted', '--surface'),
          ratio('--accent-text', '--bg'),
        ];
      });
      contrast.forEach((ratio) => expect(ratio).toBeGreaterThanOrEqual(4.5));
    }
  }
  await page.getByRole('radio', { name: 'Amber', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Nova Violet' })).toBeFocused();
  await expect(page.getByRole('radio', { name: 'Nova Violet' })).toBeChecked();
  await page.keyboard.press('End');
  await expect(
    page.getByRole('radio', { name: 'Amber', exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole('radio', { name: 'Amber', exact: true }),
  ).toBeChecked();
  await theme.selectOption('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(theme).toHaveValue('system');
  await page.reload();
  await settings(page);
  await expect(theme).toHaveValue('system');
  await expect(
    page.getByRole('radio', { name: 'Amber', exact: true }),
  ).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  for (const name of ['Home', 'Discover', 'Library', 'Profile']) {
    await page
      .getByRole('navigation')
      .getByRole('button', { name, exact: true })
      .click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'amber');
  }
  await settings(page);
  for (const width of [900, 600, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page
        .locator('main')
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
});

test('rapid switches stay immediate, focused, mounted, and synchronized while saves are pending', async ({
  page,
}) => {
  await nativeStorage(page, 220);
  await page.setViewportSize({ width: 900, height: 640 });
  await page.goto('/');
  await settings(page);
  const compact = page.getByRole('switch', { name: 'Compact game cards' });
  await compact.focus();
  const before = await compact.evaluate((element) => {
    (window as unknown as { originalSettings: unknown }).originalSettings = {
      panel: document.querySelector('#settings-panel'),
      toggle: element,
    };
    const rect = element.getBoundingClientRect();
    return { top: rect.top, scroll: document.querySelector('main')!.scrollTop };
  });
  await page.keyboard.press('Space');
  await expect(compact).toBeChecked();
  await expect(compact).toBeEnabled();
  await expect(compact).toBeFocused();
  expect(await compact.evaluate((el) => getComputedStyle(el).opacity)).toBe(
    '1',
  );
  for (let i = 0; i < 6; i++) await page.keyboard.press('Space');
  await expect(compact).toBeChecked();
  const after = await compact.evaluate((element) => {
    const original = (
      window as unknown as {
        originalSettings: { panel: Element; toggle: Element };
      }
    ).originalSettings;
    return {
      samePanel: original.panel === document.querySelector('#settings-panel'),
      sameToggle: original.toggle === element,
      top: element.getBoundingClientRect().top,
      scroll: document.querySelector('main')!.scrollTop,
    };
  });
  expect(after.samePanel && after.sameToggle).toBe(true);
  expect(after.top).toBeCloseTo(before.top, 1);
  expect(after.scroll).toBe(before.scroll);
  await page.getByRole('switch', { name: 'Reduce motion' }).focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('Space');
  await expect(
    page.getByRole('switch', { name: 'Reduce motion' }),
  ).toBeChecked();
  await expect(
    page.getByRole('switch', { name: 'Reduce motion' }),
  ).toBeFocused();
  await page
    .getByRole('combobox', { name: 'Color theme' })
    .selectOption('light');
  await page.getByRole('radio', { name: 'Teal', exact: true }).click();
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(() => ({
    data: JSON.parse(localStorage.getItem('settings-native-test')!),
    test: (
      window as unknown as {
        settingsTest: { writes: number; maxConcurrent: number };
      }
    ).settingsTest,
  }));
  expect(saved.data.preferences).toMatchObject({
    compactCards: true,
    reduceMotion: true,
    theme: 'light',
    accent: 'teal',
  });
  expect(saved.test.writes).toBe(14);
  expect(saved.test.maxConcurrent).toBe(1);
  await page.reload();
  await settings(page);
  await expect(compact).toBeChecked();
  await expect(
    page.getByRole('switch', { name: 'Reduce motion' }),
  ).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Color theme' })).toHaveValue(
    'light',
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { settingsTest: { reveal: unknown } })
            .settingsTest.reveal,
      ),
    )
    .toEqual({ theme: 'light', applied: 'light', ready: true });
});

test('failed writes roll back only failed intent and preserve later patches, focus, and page identity', async ({
  page,
}) => {
  await nativeStorage(page, 350);
  await page.goto('/');
  await settings(page);
  const compact = page.getByRole('switch', { name: 'Compact game cards' });
  await page.evaluate(() => {
    (
      window as unknown as { settingsTest: { failNext: boolean } }
    ).settingsTest.failNext = true;
  });
  await compact.click();
  await expect(compact).toBeChecked();
  await expect(page.getByRole('alert')).toContainText(
    'Preferences are read-only',
  );
  await expect(compact).not.toBeChecked();
  await expect(compact).toBeFocused();
  expect(
    await page.evaluate(() => localStorage.getItem('settings-native-test')),
  ).toBeNull();
  await page.evaluate(() => {
    (
      window as unknown as { settingsTest: { failNext: boolean } }
    ).settingsTest.failNext = true;
  });
  await page
    .getByRole('combobox', { name: 'Color theme' })
    .selectOption('light');
  await page.getByRole('radio', { name: 'Blue', exact: true }).click();
  await expect(page.getByText('Save failed', { exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'blue');
  await expect(page.getByRole('alert')).toContainText(
    'Preferences are read-only',
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('settings-native-test')!).preferences,
    ),
  ).toMatchObject({ theme: 'dark', accent: 'blue', compactCards: false });
  await page.getByRole('button', { name: 'Reload saved data' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(
    page.getByRole('radio', { name: 'Blue', exact: true }),
  ).toBeChecked();
});

test('compact cards reduce grid and list dimensions; user and OS motion preferences suppress transitions', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Add Brookhaven RP to favorites' })
    .click();
  const normal = await page.locator('.game-card').first().boundingBox();
  await settings(page);
  const toggle = page.getByRole('switch', { name: 'Compact game cards' });
  expect(
    await toggle
      .locator('span')
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe('0.15s');
  await toggle.click();
  await page.getByRole('switch', { name: 'Reduce motion' }).click();
  expect(
    await toggle
      .locator('span')
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe('0s');
  await page.getByRole('switch', { name: 'Reduce motion' }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await toggle
      .locator('span')
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe('0s');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(
    await toggle
      .locator('span')
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe('0.15s');
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Home', exact: true })
    .click();
  const compact = await page.locator('.game-card').first().boundingBox();
  expect(compact!.height).toBeLessThan(normal!.height);
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Library', exact: true })
    .click();
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  const compactList = await page.locator('.game-card-list').boundingBox();
  await settings(page);
  await toggle.click();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Library', exact: true })
    .click();
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  const normalList = await page.locator('.game-card-list').boundingBox();
  expect(compactList!.height).toBeLessThan(normalList!.height);
});

test('browser bootstrap applies saved light appearance before the React module loads', async ({
  page,
}) => {
  await page.addInitScript((defaults) => {
    localStorage.setItem(
      'nova-library-v1',
      JSON.stringify({
        ...defaults,
        preferences: {
          ...defaults.preferences,
          theme: 'light',
          accent: 'amber',
        },
      }),
    );
  }, structuredClone(defaultLibrary));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/src/main.tsx', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'amber');
  await expect(page.locator('#root')).toBeEmpty();
  await expect(page.locator('html')).toHaveCSS(
    'background-color',
    'rgb(244, 244, 247)',
  );
  release();
  await expect(
    page.getByRole('heading', { name: 'Welcome to your next adventure.' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
