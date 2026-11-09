import { isTauri, invoke } from '@tauri-apps/api/core';
import type { AdapterStatus, LibraryData } from './types';

export const defaultLibrary: LibraryData = {
  favorites: [],
  recent: [],
  preferences: {
    language: 'system',
    theme: 'dark',
    accent: 'violet',
    compactCards: false,
    reduceMotion: false,
    startPage: 'home',
    preferredAdapter: 'auto',
  },
};
const key = 'nova-library-v1';
const pages = ['home', 'discover', 'library', 'profile', 'settings'];
export function validateLibrary(raw: unknown): LibraryData {
  if (!raw || typeof raw !== 'object')
    throw new Error('Saved library is invalid.');
  const data = raw as LibraryData;
  if (
    !Array.isArray(data.favorites) ||
    !data.favorites.every((id) => typeof id === 'string') ||
    !Array.isArray(data.recent) ||
    !data.recent.every(
      (r) =>
        r &&
        typeof r.gameId === 'string' &&
        typeof r.launchedAt === 'string' &&
        Number.isFinite(Date.parse(r.launchedAt)),
    ) ||
    !data.preferences ||
    typeof data.preferences.compactCards !== 'boolean' ||
    typeof data.preferences.reduceMotion !== 'boolean' ||
    !pages.includes(data.preferences.startPage) ||
    !['auto', 'windows', 'sober'].includes(data.preferences.preferredAdapter) ||
    (data.preferences.language !== undefined &&
      !['system', 'tr', 'en'].includes(data.preferences.language)) ||
    (data.preferences.theme !== undefined &&
      !['dark', 'light', 'system'].includes(data.preferences.theme)) ||
    (data.preferences.accent !== undefined &&
      !['violet', 'blue', 'teal', 'amber'].includes(data.preferences.accent))
  ) {
    throw new Error(
      'Saved library is invalid. Existing data has not been overwritten.',
    );
  }
  return {
    ...data,
    favorites: [...new Set(data.favorites)],
    preferences: {
      ...data.preferences,
      language: data.preferences.language ?? 'system',
      theme: data.preferences.theme ?? 'dark',
      accent: data.preferences.accent ?? 'violet',
    },
  };
}
export async function readLibrary(): Promise<LibraryData> {
  if (isTauri()) return validateLibrary(await invoke('load_library'));
  const saved = localStorage.getItem(key);
  return saved
    ? validateLibrary(JSON.parse(saved))
    : structuredClone(defaultLibrary);
}
export async function writeLibrary(data: LibraryData): Promise<void> {
  validateLibrary(data);
  if (isTauri()) await invoke('save_library', { data });
  else localStorage.setItem(key, JSON.stringify(data));
}
export async function detectAdapters(): Promise<AdapterStatus[]> {
  if (isTauri()) return invoke('detect_installations');
  return ['windows', 'sober'].map((id) => ({
    id: id as AdapterStatus['id'],
    name: id === 'windows' ? 'Windows Player' : 'Sober',
    platform: id === 'windows' ? 'Windows 10 / 11' : 'Linux · Flatpak',
    installation: 'unknown',
    location: null,
    detail: 'Installation detection is available in the desktop app.',
    capabilities: { detect: false, launch: false, directJoin: false },
    runtimeVerified: false,
  }));
}
export const storageLabel = isTauri()
  ? 'SQLite · on this device'
  : 'Browser storage · web preview';
