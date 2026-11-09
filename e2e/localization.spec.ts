import { expect, test } from '@playwright/test';
import { mockPublicData } from './public-data';
import { defaultLibrary } from '../src/lib/storage';

test.use({ locale: 'tr-TR' });
test.beforeEach(async ({ page }) => {
  await mockPublicData(page);
});

test('automatic Turkish, instant manual overrides, focus/scroll identity, persistence and existing appearance settings (browser storage)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 640 });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await page.getByRole('button', { name: 'Ayarlar', exact: true }).click();
  const language = page.getByRole('combobox', { name: 'Dil', exact: true });
  await expect(language).toHaveValue('system');
  await language.focus();
  const before = await language.evaluate((el) => {
    (window as unknown as { localeNodes: unknown }).localeNodes = {
      select: el,
      panel: document.getElementById('settings-panel'),
    };
    const main = document.querySelector('main')!;
    main.scrollTop = 25;
    return main.scrollTop;
  });
  await language.selectOption('en');
  const english = page.getByRole('combobox', { name: 'Language', exact: true });
  await expect(english).toBeFocused();
  expect(
    await english.evaluate((el) => {
      const saved = (
        window as unknown as {
          localeNodes: { select: Element; panel: Element };
        }
      ).localeNodes;
      return (
        saved.select === el &&
        saved.panel === document.getElementById('settings-panel')
      );
    }),
  ).toBe(true);
  expect(await page.locator('main').evaluate((el) => el.scrollTop)).toBe(
    before,
  );
  await expect(page).toHaveTitle('Nova Launcher · Settings');
  await page
    .getByRole('combobox', { name: 'Color theme' })
    .selectOption('light');
  await page.getByRole('radio', { name: 'Teal', exact: true }).click();
  await page.getByRole('switch', { name: 'Compact game cards' }).click();
  await page.getByRole('switch', { name: 'Reduce motion' }).click();
  await english.selectOption('tr');
  await expect(
    page.getByRole('switch', { name: 'Kompakt oyun kartları' }),
  ).toBeChecked();
  await expect(
    page.getByRole('switch', { name: 'Hareketi azalt' }),
  ).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'teal');
  await page.reload();
  await page.getByRole('button', { name: 'Ayarlar', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Dil', exact: true }),
  ).toHaveValue('tr');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('nova-library-v1')!).preferences,
    ),
  ).toMatchObject({
    language: 'tr',
    theme: 'light',
    accent: 'teal',
    compactCards: true,
    reduceMotion: true,
  });
  for (const width of [900, 600, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of [
      'Ana sayfa',
      'Keşfet',
      'Kütüphane',
      'Profil',
      'Ayarlar',
    ]) {
      await page
        .getByRole('navigation')
        .getByRole('button', { name, exact: true })
        .click();
      expect(
        await page
          .locator('main')
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});

test('localized bootstrap applies saved manual English before React while OS language is Turkish', async ({
  page,
}) => {
  await page.addInitScript(
    (defaults) =>
      localStorage.setItem(
        'nova-library-v1',
        JSON.stringify({
          ...defaults,
          preferences: { ...defaults.preferences, language: 'en' },
        }),
      ),
    defaultLibrary,
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/src/main.tsx', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#root')).toBeEmpty();
  release();
  await expect(
    page.getByRole('heading', { name: 'Welcome to your next adventure.' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('modal keyboard focus returns to opener and localized Ctrl K focuses loaded-catalog search', async ({
  page,
}) => {
  await page.goto('/');
  const opener = page.getByRole('button', {
    name: 'Oyunu keşfet',
    exact: true,
  });
  await opener.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Oyun ayrıntılarını kapat' }),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(
    await page
      .getByRole('dialog')
      .evaluate((dialog) => dialog.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('textbox', { name: 'Oyun ara' })).toBeFocused();
  await expect(
    page.getByText(/Yalnızca yüklenen verileri filtreler/),
  ).toBeVisible();
});

test('Discover filters details and rejects old Universe completion after a newer selection or query', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Keşfet', exact: true }).click();
  const panel = page.getByRole('complementary', {
    name: 'Seçili oyun ayrıntıları',
  });
  await page
    .getByRole('button', { name: 'Blade Ball oyununu görüntüle' })
    .click();
  const search = page.getByRole('textbox', { name: 'Oyun ara' });
  await search.fill('Brookhaven');
  await expect(
    panel.getByRole('heading', { name: 'Brookhaven RP' }),
  ).toBeVisible();
  await search.fill('no matching game');
  await expect(panel.getByText('Bir deneyim seç')).toBeVisible();
  await search.fill('');
  const universe = page.getByLabel('Universe kimliği', { exact: true });
  await universe.fill('1');
  await page.getByRole('button', { name: 'Deneyimi sorgula' }).click();
  await page
    .getByRole('button', { name: 'Blade Ball oyununu görüntüle' })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { universeCompletions: string[] })
            .universeCompletions,
      ),
    )
    .toContain('1');
  await expect(
    panel.getByRole('heading', { name: 'Blade Ball' }),
  ).toBeVisible();
  await universe.fill('2');
  await page.getByRole('button', { name: 'Deneyimi sorgula' }).click();
  await expect(
    panel.getByRole('heading', { name: 'Brookhaven RP' }),
  ).toBeVisible();
  await expect(
    panel.getByRole('link', { name: "Roblox'ta görüntüle" }),
  ).toHaveAttribute('href', 'https://www.roblox.com/games/4924922222');
  await universe.fill('0');
  await page.getByRole('button', { name: 'Deneyimi sorgula' }).click();
  expect(
    await universe.evaluate((el) => (el as HTMLInputElement).validationMessage),
  ).toContain('Universe kimliği');
});

test('Profile query identity, pagination races, localized rate limits and offline diagnostics', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Roblox kullanıcı adı' });
  await input.fill('Roblox');
  await page
    .getByRole('button', { name: 'Kullanıcı bul', exact: true })
    .click();
  await page.evaluate(() => {
    (window as unknown as { publicDataTest: unknown }).publicDataTest = {
      slowPage: true,
    };
  });
  const matchesHeading = page.locator('.user-results h3');
  const originalTop = (await matchesHeading.boundingBox())!.y;
  await page.getByRole('button', { name: 'Daha fazla kullanıcı' }).click();
  expect((await matchesHeading.boundingBox())!.y).toBeCloseTo(originalTop, 1);
  await input.fill('Newer');
  await expect(page.getByText('@Roblox', { exact: true })).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { publicDataCompletions: string[] })
            .publicDataCompletions,
      ),
    )
    .toContain('page');
  await expect(page.getByText('@Builder', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Profil ara', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Newer/ })).toBeVisible();
  await input.fill('Edited');
  await expect(page.getByRole('heading', { name: /^Newer/ })).toHaveCount(0);
  await page.evaluate(() => {
    (window as unknown as { publicDataTest: unknown }).publicDataTest = {
      rateLimited: true,
    };
  });
  await page
    .getByRole('button', { name: 'Kullanıcı bul', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'saniye sonra tekrar dene',
  );
  await expect(
    page.getByRole('button', { name: 'Kullanıcı bul', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText('Original rate-limit diagnostic'),
  ).not.toBeVisible();
  await page.getByText('Teknik ayrıntılar', { exact: true }).click();
  await expect(page.getByText('Original rate-limit diagnostic')).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { publicDataTest: unknown }).publicDataTest = {
      fail: true,
    };
  });
  await page.getByRole('button', { name: 'Profil ara', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText("Roblox'a ulaşılamadı");
});
