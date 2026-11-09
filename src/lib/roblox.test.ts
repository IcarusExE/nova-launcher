import { beforeEach, describe, expect, it, vi } from 'vitest';
import { catalog, games } from '../test/fixtures';
import { filterGames, rating, robloxRequest, officialPage } from './roblox';
const native = vi.hoisted(() => ({ enabled: true, invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => native.enabled,
  invoke: native.invoke,
}));
beforeEach(() => {
  native.enabled = true;
  native.invoke.mockReset();
});
describe('typed public API boundary', () => {
  it('requires the desktop bridge and never substitutes fixtures in the browser', async () => {
    native.enabled = false;
    await expect(
      robloxRequest({ action: 'catalog' }, 'catalog'),
    ).rejects.toMatchObject({ code: 'desktopRequired' });
    expect(native.invoke).not.toHaveBeenCalled();
  });
  it('deduplicates overlapping identical requests and rejects the wrong response kind', async () => {
    let finish!: (value: unknown) => void;
    native.invoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const a = robloxRequest({ action: 'catalog' }, 'catalog');
    const b = robloxRequest({ action: 'catalog' }, 'catalog');
    finish({ kind: 'catalog', data: catalog });
    expect(await a).toEqual(await b);
    expect(native.invoke).toHaveBeenCalledTimes(1);
    native.invoke.mockResolvedValue({ kind: 'users', data: {} });
    await expect(
      robloxRequest({ action: 'catalog' }, 'catalog'),
    ).rejects.toMatchObject({ code: 'invalidResponse' });
  });
  it('preserves actionable native errors and permits retry after a failed request', async () => {
    native.invoke.mockRejectedValueOnce({
      code: 'rateLimited',
      message: 'Wait before retrying',
      retryAfterSeconds: 60,
    });
    await expect(
      robloxRequest(
        { action: 'searchUsers', keyword: 'Roblox', cursor: null },
        'users',
      ),
    ).rejects.toMatchObject({ code: 'rateLimited', retryAfterSeconds: 60 });
    native.invoke.mockResolvedValue({ kind: 'catalog', data: catalog });
    expect(await robloxRequest({ action: 'catalog' }, 'catalog')).toEqual(
      catalog,
    );
  });
  it('keeps unavailable metrics absent and sorts only fetched metadata', () => {
    expect(officialPage('games', '123/../../settings')).toBeNull();
    expect(officialPage('users', '18446744073709551616')).toBeNull();
    expect(officialPage('users', '1')).toBe(
      'https://www.roblox.com/users/1/profile',
    );
    expect(rating({ ...games[0], upVotes: null })).toBeNull();
    expect(rating({ ...games[0], upVotes: 0, downVotes: 0 })).toBeNull();
    expect(rating({ ...games[0], upVotes: 3, downVotes: 1 })).toBe(75);
    expect(
      filterGames(games, 'BROOKHAVEN', 'All games', 'Name').map((g) => g.id),
    ).toEqual(['4924922222']);
    expect(
      filterGames(games, '', 'Action', 'Playing', ['13772394625']),
    ).toHaveLength(1);
  });
});
