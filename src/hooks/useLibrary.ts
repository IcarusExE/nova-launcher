import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultLibrary, readLibrary, writeLibrary } from '../lib/storage';
import type { LibraryData, Preferences } from '../lib/types';

export function useLibrary() {
  const [data, setData] = useState<LibraryData>(
    structuredClone(defaultLibrary),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const current = useRef(data);
  const writing = useRef(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await readLibrary();
      current.current = loaded;
      setData(loaded);
      setReady(true);
    } catch (e) {
      setReady(false);
      setError(
        e instanceof Error ? e.message : 'Could not read the local library.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const commit = async (next: LibraryData) => {
    if (!ready || writing.current) return;
    writing.current = true;
    setSaving(true);
    setError(null);
    try {
      await writeLibrary(next);
      current.current = next;
      setData(next);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not save changes. Try again.',
      );
    } finally {
      writing.current = false;
      setSaving(false);
    }
  };
  return {
    data,
    loading,
    saving,
    ready,
    error,
    reload: load,
    toggleFavorite: (id: string) =>
      commit({
        ...current.current,
        favorites: current.current.favorites.includes(id)
          ? current.current.favorites.filter((x) => x !== id)
          : [...current.current.favorites, id],
      }),
    updatePreferences: (preferences: Partial<Preferences>) =>
      commit({
        ...current.current,
        preferences: { ...current.current.preferences, ...preferences },
      }),
  };
}
export type LibraryStore = ReturnType<typeof useLibrary>;
