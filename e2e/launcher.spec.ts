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
