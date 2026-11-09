import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { App } from './App';
import { catalog, profile } from './test/fixtures';
import { robloxRequest } from './lib/roblox';
import type { ApiRequest } from './lib/roblox';

vi.mock('./lib/roblox', async (original) => ({
  ...(await original<typeof import('./lib/roblox')>()),
  robloxRequest: vi.fn(),
}));
const request = vi.mocked(robloxRequest);
beforeEach(() => {
  request.mockReset();
  request.mockImplementation(async (action, kind) => {
    if (kind === 'profile') return structuredClone(profile) as never;
    if (kind === 'experience')
      return { experience: catalog.experiences[0], warnings: [] } as never;
    if (action.action === 'cachedCatalog')
      return { ...catalog, experiences: [] } as never;
    return structuredClone(catalog) as never;
  });
});

it('ignores stale profile responses after a newer query and after clearing the input', async () => {
  const user = userEvent.setup();
  let old!: (value: unknown) => void;
  request.mockImplementation(async (action, kind) => {
    if (kind !== 'profile') return catalog as never;
    if (action.action === 'lookupUsername' && action.username === 'Older')
      return new Promise((resolve) => {
        old = resolve;
      }) as never;
    return { ...profile, username: 'Newer', displayName: 'Newer' } as never;
  });
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Profile' }));
  const input = screen.getByRole('textbox', { name: 'Roblox username' });
  await user.type(input, 'Older');
  await user.click(screen.getByRole('button', { name: 'Search profile' }));
  await user.clear(input);
  await user.type(input, 'Newer');
  await user.click(screen.getByRole('button', { name: 'Search profile' }));
  await screen.findByRole('heading', { name: /^Newer/ });
  await act(async () => old({ ...profile, displayName: 'Older' }));
  expect(screen.queryByRole('heading', { name: 'Older' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Clear username' }));
  expect(screen.queryByRole('heading', { name: /^Newer/ })).toBeNull();
});

it('loads public user continuation pages without confusing user IDs with Place IDs', async () => {
  const user = userEvent.setup();
  request.mockImplementation(async (action, kind) => {
    if (kind !== 'users') return catalog as never;
    const next = action.action === 'searchUsers' && Boolean(action.cursor);
    return {
      users: [
        {
          id: next ? '2' : '1',
          username: next ? 'Builder' : 'Roblox',
          displayName: next ? 'Builder' : 'Roblox',
          verified: false,
        },
      ],
      nextCursor: next ? null : 'opaque+/=',
      retryAfterSeconds: 0,
    } as never;
  });
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Profile' }));
  await user.type(
    screen.getByRole('textbox', { name: 'Roblox username' }),
    'Roblox',
  );
  await user.click(screen.getByRole('button', { name: 'Find users' }));
  await user.click(await screen.findByRole('button', { name: 'More users' }));
  expect(await screen.findByText('@Builder')).toBeVisible();
  expect(screen.getByText('@Roblox')).toBeVisible();
  expect(request).toHaveBeenCalledWith(
    { action: 'searchUsers', keyword: 'Roblox', cursor: 'opaque+/=' },
    'users',
  );
});

it('shows cached metadata with an offline warning and preserves unknown favorite Place IDs across reload', async () => {
  const user = userEvent.setup();
  const { defaultLibrary } = await import('./lib/storage');
  localStorage.setItem(
    'nova-library-v1',
    JSON.stringify({ ...defaultLibrary, favorites: ['123', '4924922222'] }),
  );
  request.mockImplementation(async (action: ApiRequest) => {
    if (action.action === 'catalog')
      throw { code: 'offline', message: 'Test connection offline' };
    return {
      ...catalog,
      experiences: catalog.experiences.map((g) => ({ ...g, cached: true })),
    } as never;
  });
  const { unmount } = render(<App />);
  await screen.findByText(/Test connection offline/);
  expect(screen.getByText(/Saved snapshots may be out of date/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: /^Library/ }));
  expect(
    await screen.findByRole('heading', { name: 'Place 123' }),
  ).toBeVisible();
  expect(
    screen.getByRole('link', { name: 'Open official experience page' }),
  ).toHaveAttribute('href', 'https://www.roblox.com/games/123');
  expect(
    JSON.parse(localStorage.getItem('nova-library-v1')!).favorites,
  ).toEqual(['123', '4924922222']);
  unmount();
  render(<App />);
  await user.click(screen.getByRole('button', { name: /^Library/ }));
  await screen.findByRole('heading', { name: 'Place 123' });
  await user.click(
    screen.getByRole('button', { name: 'Remove Place 123 from favorites' }),
  );
  await waitFor(() =>
    expect(
      JSON.parse(localStorage.getItem('nova-library-v1')!).favorites,
    ).toEqual(['4924922222']),
  );
});

it('keeps settings controls mounted and focused when an asynchronous catalog finishes', async () => {
  const user = userEvent.setup();
  let finish!: (data: unknown) => void;
  request.mockImplementation(async (action) =>
    action.action === 'catalog'
      ? (new Promise((resolve) => {
          finish = resolve;
        }) as never)
      : ({ ...catalog, experiences: [] } as never),
  );
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Settings' }));
  const toggle = screen.getByRole('switch', { name: 'Compact game cards' });
  await user.click(toggle);
  const panel = document.querySelector('#settings-panel');
  await act(async () => finish(catalog));
  expect(screen.getByRole('switch', { name: 'Compact game cards' })).toBe(
    toggle,
  );
  expect(toggle).toHaveFocus();
  expect(toggle).toBeChecked();
  expect(document.querySelector('#settings-panel')).toBe(panel);
});
