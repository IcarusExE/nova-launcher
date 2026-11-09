import { expect, test } from '@playwright/test';
import { mockPublicData } from './public-data';

test('public data UI: stale search responses, pagination, failure recovery and identifier separation (isolated service fixture)', async ({
  page,
}) => {
  await mockPublicData(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Roblox username' });
  await input.fill('Older');
  await page.getByRole('button', { name: 'Search profile' }).click();
  await input.fill('Newer');
  await page.getByRole('button', { name: 'Search profile' }).click();
  await expect(page.getByRole('heading', { name: /^Newer/ })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { publicDataCompletions: string[] })
            .publicDataCompletions,
      ),
    )
    .toContain('Older');
  // A deliberate old delayed response must not replace the new identity.
  await expect(
    page.getByRole('heading', { name: 'Older', exact: true }),
  ).toHaveCount(0);
  await input.fill('Roblox');
  await page.getByRole('button', { name: 'Find users' }).click();
  await page.getByRole('button', { name: 'More users' }).click();
  await expect(page.getByText('@Builder', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { publicDataTest: unknown }).publicDataTest = {
      fail: true,
    };
  });
  await page.getByRole('button', { name: 'Search profile' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Test connection is offline',
  );
  await page.evaluate(() => {
    (window as unknown as { publicDataTest: unknown }).publicDataTest = {};
  });
  await page.getByRole('button', { name: 'Search profile' }).click();
  await expect(
    page.getByRole('link', { name: 'Open public Roblox profile' }),
  ).toHaveAttribute('href', 'https://www.roblox.com/users/1/profile');
  await page.getByRole('button', { name: 'Discover', exact: true }).click();
  await page.getByLabel('Universe ID', { exact: true }).fill('994732206');
  await page.getByRole('button', { name: 'Look up experience' }).click();
  await expect(
    page.getByRole('link', { name: 'View on Roblox' }),
  ).toHaveAttribute('href', 'https://www.roblox.com/games/2753915549');
  await expect(
    page.getByText(/General Roblox experience search is unavailable/),
  ).toBeVisible();
});

test('browser preview reports desktop requirement without production fixtures', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByText(/Live Roblox data requires the Nova desktop app/),
  ).toBeVisible();
  await expect(page.locator('.game-card')).toHaveCount(0);
});
