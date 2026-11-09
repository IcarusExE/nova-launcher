import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { App } from './App';
import { catalog, games, profile } from './test/fixtures';
import { robloxRequest } from './lib/roblox';
vi.mock('./lib/roblox', async (original) => ({
  ...(await original<typeof import('./lib/roblox')>()),
  robloxRequest: vi.fn(),
}));
const request = vi.mocked(robloxRequest);
const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
beforeEach(() => {
  request.mockReset().mockImplementation(async (action, kind) => {
    if (kind === 'catalog') return catalog as never;
    if (kind === 'profile') return profile as never;
    if (kind === 'users')
      return {
        users: [
          {
            id: '1',
            username: 'Roblox',
            displayName: 'Roblox',
            verified: false,
          },
        ],
        nextCursor:
          action.action === 'searchUsers' && action.cursor ? null : 'next',
        retryAfterSeconds: 0,
      } as never;
    return { experience: games[0], warnings: [] } as never;
  });
});

it('keeps Discover details in the filtered set, clears empty details and preserves a valid selection on sort changes', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Discover' }));
  await user.click(
    await screen.findByRole('button', { name: 'View Blade Ball' }),
  );
  const panel = screen.getByRole('complementary', {
    name: 'Selected game details',
  });
  expect(
    within(panel).getByRole('heading', { name: 'Blade Ball' }),
  ).toBeVisible();
  await user.selectOptions(screen.getByLabelText('Sort games'), 'Name');
  expect(
    within(panel).getByRole('heading', { name: 'Blade Ball' }),
  ).toBeVisible();
  await user.type(screen.getByLabelText('Search games'), 'Brookhaven');
  expect(
    within(panel).getByRole('heading', { name: 'Brookhaven RP' }),
  ).toBeVisible();
  expect(
    within(panel).queryByRole('heading', { name: 'Blade Ball' }),
  ).toBeNull();
  await user.clear(screen.getByLabelText('Search games'));
  expect(
    within(panel).getByRole('heading', { name: 'Brookhaven RP' }),
  ).toBeVisible();
  await user.type(screen.getByLabelText('Search games'), 'nonexistent');
  expect(within(panel).getByText('Choose an experience')).toBeVisible();
});

it('discards Universe completion selection after newer card/filter intent and selects a newer lookup', async () => {
  const old = deferred(),
    newer = deferred();
  const base = request.getMockImplementation()!;
  request.mockImplementation((action, kind) =>
    action.action === 'lookupUniverse'
      ? ((action.universeId === '1' ? old.promise : newer.promise) as never)
      : base(action, kind),
  );
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Discover' }));
  const input = screen.getByLabelText('Universe ID');
  await user.type(input, '1');
  await user.click(screen.getByRole('button', { name: 'Look up experience' }));
  await user.click(
    await screen.findByRole('button', { name: 'View Blade Ball' }),
  );
  await act(async () => old.resolve({ experience: games[0], warnings: [] }));
  const panel = screen.getByRole('complementary', {
    name: 'Selected game details',
  });
  expect(
    within(panel).getByRole('heading', { name: 'Blade Ball' }),
  ).toBeVisible();
  await user.clear(input);
  await user.type(input, '2');
  await user.click(screen.getByRole('button', { name: 'Look up experience' }));
  await act(async () => newer.resolve({ experience: games[1], warnings: [] }));
  expect(
    within(panel).getByRole('heading', { name: 'Brookhaven RP' }),
  ).toBeVisible();
  expect(
    within(panel).getByRole('link', { name: 'View on Roblox' }),
  ).toHaveAttribute('href', 'https://www.roblox.com/games/4924922222');
});

it('clears earlier profile and pagination on editing, ignoring stale continuation and selected-user responses', async () => {
  const pending = deferred();
  const base = request.getMockImplementation()!;
  request.mockImplementation((action, kind) =>
    action.action === 'searchUsers' && action.cursor
      ? (pending.promise as never)
      : base(action, kind),
  );
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Profile' }));
  const input = screen.getByLabelText('Roblox username');
  await user.type(input, 'Roblox');
  await user.click(screen.getByRole('button', { name: 'Find users' }));
  await user.click(await screen.findByRole('button', { name: 'More users' }));
  await user.clear(input);
  await user.type(input, 'Newer');
  expect(screen.queryByText('@Roblox')).toBeNull();
  expect(screen.queryByRole('button', { name: 'More users' })).toBeNull();
  await act(async () =>
    pending.resolve({
      users: [
        {
          id: '2',
          username: 'OlderPage',
          displayName: 'OlderPage',
          verified: false,
        },
      ],
      nextCursor: 'old',
      retryAfterSeconds: 30,
    }),
  );
  expect(screen.queryByText('@OlderPage')).toBeNull();
  expect(screen.getByRole('button', { name: 'Find users' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Search profile' }));
  await screen.findByRole('link', { name: 'Open public Roblox profile' });
  await user.type(input, 'Edit');
  expect(
    screen.queryByRole('link', { name: 'Open public Roblox profile' }),
  ).toBeNull();
  expect(screen.getByRole('button', { name: 'Find users' })).toBeDisabled();
});

it('keeps the latest concurrent Universe result and preserves filter intent against a late lookup', async () => {
  const first = deferred(),
    second = deferred(),
    third = deferred();
  const base = request.getMockImplementation()!;
  request.mockImplementation((action, kind) =>
    action.action === 'lookupUniverse'
      ? ({ '1': first, '2': second, '3': third }[action.universeId]!
          .promise as never)
      : base(action, kind),
  );
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Discover' }));
  const input = screen.getByLabelText('Universe ID');
  await user.type(input, '1');
  await user.click(screen.getByRole('button', { name: 'Look up experience' }));
  await user.clear(input);
  await user.type(input, '2');
  await user.click(screen.getByRole('button', { name: 'Look up experience' }));
  await act(async () => second.resolve({ experience: games[1], warnings: [] }));
  const panel = screen.getByRole('complementary', {
    name: 'Selected game details',
  });
  expect(
    within(panel).getByRole('heading', { name: 'Brookhaven RP' }),
  ).toBeVisible();
  await act(async () => first.resolve({ experience: games[0], warnings: [] }));
  expect(
    within(panel).getByRole('heading', { name: 'Brookhaven RP' }),
  ).toBeVisible();
  await user.clear(input);
  await user.type(input, '3');
  await user.click(screen.getByRole('button', { name: 'Look up experience' }));
  await user.type(screen.getByLabelText('Search games'), 'Blade');
  await act(async () => third.resolve({ experience: games[0], warnings: [] }));
  expect(screen.getByLabelText('Search games')).toHaveValue('Blade');
  expect(
    within(panel).getByRole('heading', { name: 'Blade Ball' }),
  ).toBeVisible();
});

it('never overwrites a newer observation with a delayed catalog/cache/lookup response', async () => {
  const { mergeExperiences } = await import('./hooks/useCatalog');
  const fresh = {
    ...games[0],
    name: 'Newest Roblox name',
    observedAt: 2000,
    cached: false,
  };
  const old = { ...games[0], name: 'Old name', observedAt: 1000, cached: true };
  expect(mergeExperiences([fresh], [old])).toEqual([fresh]);
  expect(mergeExperiences([old], [fresh])).toEqual([fresh]);
  expect(mergeExperiences([fresh], [{ ...fresh, cached: true }])).toEqual([
    fresh,
  ]);
});
