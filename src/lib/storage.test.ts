import { describe, expect, it, vi } from 'vitest';
import {
  defaultLibrary,
  detectAdapters,
  readLibrary,
  validateLibrary,
  writeLibrary,
} from './storage';

describe('local storage boundary', () => {
  it('persists favorites and preferences across reads', async () => {
    const data = structuredClone(defaultLibrary);
    data.favorites = ['2753915549'];
    data.preferences.startPage = 'library';
    await writeLibrary(data);
    expect(await readLibrary()).toEqual(data);
  });
  it('adds appearance defaults to legacy preferences without changing other data', () => {
    const legacy = {
      ...structuredClone(defaultLibrary),
      favorites: ['123'],
      preferences: {
        compactCards: true,
        reduceMotion: true,
        startPage: 'library',
        preferredAdapter: 'sober',
      },
    };
    expect(validateLibrary(legacy)).toEqual({
      ...legacy,
      preferences: {
        ...legacy.preferences,
        language: 'system',
        theme: 'dark',
        accent: 'violet',
      },
    });
  });
  it('rejects unknown appearance values without silently replacing them', () => {
    for (const patch of [
      { theme: 'neon' },
      { accent: 'red' },
      { theme: null },
      { language: 'de' },
      { language: null },
    ]) {
      expect(() =>
        validateLibrary({
          ...defaultLibrary,
          preferences: { ...defaultLibrary.preferences, ...patch },
        }),
      ).toThrow();
    }
  });
  it('does not overwrite corrupt data when reading fails', async () => {
    localStorage.setItem('nova-library-v1', '{broken');
    await expect(readLibrary()).rejects.toThrow();
    expect(localStorage.getItem('nova-library-v1')).toBe('{broken');
  });
  it('rejects invalid preferences and history', () => {
    expect(() =>
      validateLibrary({
        ...defaultLibrary,
        preferences: { startPage: 'unknown' },
      }),
    ).toThrow();
    expect(() =>
      validateLibrary({
        ...defaultLibrary,
        recent: [{ gameId: '1', launchedAt: 'bad' }],
      }),
    ).toThrow();
  });
  it('propagates quota failures without claiming a save', async () => {
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('Storage is full', 'QuotaExceededError');
      });
    await expect(writeLibrary(defaultLibrary)).rejects.toThrow(
      'Storage is full',
    );
    spy.mockRestore();
  });
  it('never reports an installation or launch support in the web preview', async () => {
    for (const status of await detectAdapters()) {
      expect(status.installation).toBe('unknown');
      expect(status.capabilities).toEqual({
        detect: false,
        launch: false,
        directJoin: false,
      });
    }
  });
});
