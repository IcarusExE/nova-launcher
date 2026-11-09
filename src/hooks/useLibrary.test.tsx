import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultLibrary } from '../lib/storage';
import { useLibrary } from './useLibrary';
import type { LibraryData } from '../lib/types';

const storage = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock('../lib/storage', async (original) => ({
  ...(await original<typeof import('../lib/storage')>()),
  readLibrary: storage.read,
  writeLibrary: storage.write,
}));
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  storage.read.mockReset().mockResolvedValue(structuredClone(defaultLibrary));
  storage.write.mockReset().mockResolvedValue(undefined);
});
describe('serialized local changes', () => {
  it('applies rapid preferences immediately and serializes rebased favorites and preferences', async () => {
    const first = deferred();
    storage.write.mockImplementationOnce(() => first.promise);
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => {
      void result.current.updatePreferences({ compactCards: true });
      void result.current.updatePreferences({ compactCards: false });
      void result.current.updatePreferences({ accent: 'teal' });
      void result.current.toggleFavorite('123');
      void result.current.updatePreferences({ reduceMotion: true });
    });
    expect(result.current.data.preferences).toMatchObject({
      compactCards: false,
      accent: 'teal',
      reduceMotion: true,
    });
    expect(result.current.data.favorites).toEqual([]);
    expect(storage.write).toHaveBeenCalledTimes(1);
    await act(async () => first.resolve());
    await waitFor(() => expect(result.current.saving).toBe(false));
    const last = storage.write.mock.calls.at(-1)![0] as LibraryData;
    expect(last).toEqual(result.current.data);
    expect(last.favorites).toEqual(['123']);
    expect(storage.write).toHaveBeenCalledTimes(5);
  });
  it('rolls back a failed patch, keeps newer intent, and reports the failure', async () => {
    const first = deferred();
    storage.write.mockImplementationOnce(() => first.promise);
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => {
      void result.current.updatePreferences({
        theme: 'light',
        compactCards: true,
      });
      void result.current.updatePreferences({ accent: 'amber' });
    });
    expect(result.current.data.preferences.theme).toBe('light');
    await act(async () => first.reject(new Error('SQLite is read-only')));
    await waitFor(() => expect(result.current.saving).toBe(false));
    expect(result.current.error).toBe('SQLite is read-only');
    expect(result.current.data.preferences).toMatchObject({
      theme: 'dark',
      compactCards: false,
      accent: 'amber',
    });
    expect(storage.write.mock.calls.at(-1)![0]).toEqual(result.current.data);
  });
  it('does not overwrite newer values with a reload that races pending writes', async () => {
    const first = deferred();
    storage.write.mockImplementationOnce(() => first.promise);
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => {
      void result.current.updatePreferences({ theme: 'light' });
    });
    storage.read.mockResolvedValue({
      ...structuredClone(defaultLibrary),
      preferences: { ...defaultLibrary.preferences, theme: 'light' },
    });
    act(() => {
      void result.current.reload();
    });
    expect(storage.read).toHaveBeenCalledTimes(1);
    expect(result.current.ready).toBe(false);
    await act(async () => first.resolve());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.data.preferences.theme).toBe('light');
    expect(storage.read).toHaveBeenCalledTimes(2);
  });
  it('ignores an older hydration result after a newer reload', async () => {
    let resolve!: (data: LibraryData) => void;
    storage.read.mockImplementationOnce(
      () =>
        new Promise<LibraryData>((done) => {
          resolve = done;
        }),
    );
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(storage.read).toHaveBeenCalledTimes(1));
    storage.read.mockResolvedValue({
      ...structuredClone(defaultLibrary),
      favorites: ['123'],
    });
    await act(async () => result.current.reload());
    await act(async () => resolve(structuredClone(defaultLibrary)));
    expect(result.current.data.favorites).toEqual(['123']);
  });
});
