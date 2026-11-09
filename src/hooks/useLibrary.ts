import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultLibrary, readLibrary, writeLibrary } from '../lib/storage';
import { errorMessage } from '../lib/launcher';
import type { LibraryData, Preferences } from '../lib/types';

type Change = {
  apply: (data: LibraryData) => LibraryData;
  optimistic: boolean;
  resolve: () => void;
};

export function useLibrary() {
  const [data, setData] = useState<LibraryData>(() =>
    structuredClone(defaultLibrary),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorOperation, setErrorOperation] = useState<'read' | 'save'>('read');
  const [ready, setReady] = useState(false);
  const confirmed = useRef(data);
  const available = useRef(false);
  const queue = useRef<Change[]>([]);
  const writer = useRef<Promise<void> | null>(null);
  const generation = useRef(0);

  // Rebase pending preference patches on the last acknowledged snapshot. Favorites
  // remain acknowledged-only. Every operation shares this queue, so a favorites
  // write cannot overwrite newer preferences (or the reverse).
  const publish = useCallback(() => {
    setData(
      queue.current.reduce(
        (value, change) => (change.optimistic ? change.apply(value) : value),
        confirmed.current,
      ),
    );
  }, []);

  const load = useCallback(async () => {
    const version = ++generation.current;
    available.current = false;
    setReady(false);
    setLoading(true);
    await writer.current;
    if (version !== generation.current) return;
    setError(null);
    setErrorOperation('read');
    try {
      const loaded = await readLibrary();
      if (version !== generation.current) return;
      confirmed.current = loaded;
      setData(loaded);
      available.current = true;
      setReady(true);
    } catch (e) {
      if (version === generation.current)
        setError(errorMessage(e, 'Could not read the local library.'));
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);

  const commit = (apply: Change['apply'], optimistic: boolean) => {
    if (!available.current) return Promise.resolve();
    const result = new Promise<void>((resolve) => {
      queue.current.push({ apply, optimistic, resolve });
    });
    setError(null);
    setSaving(true);
    publish();
    if (!writer.current) {
      writer.current = (async () => {
        while (queue.current.length) {
          const change = queue.current[0];
          const next = change.apply(confirmed.current);
          try {
            await writeLibrary(next);
            confirmed.current = next;
          } catch (e) {
            setErrorOperation('save');
            setError(errorMessage(e, 'Could not save changes. Try again.'));
          }
          queue.current.shift();
          publish();
          change.resolve();
        }
        writer.current = null;
        setSaving(false);
      })();
    }
    return result;
  };
  return {
    data,
    loading,
    saving,
    ready,
    error,
    errorOperation,
    reload: load,
    toggleFavorite: (id: string) =>
      commit(
        (value) => ({
          ...value,
          favorites: value.favorites.includes(id)
            ? value.favorites.filter((x) => x !== id)
            : [...value.favorites, id],
        }),
        false,
      ),
    updatePreferences: (preferences: Partial<Preferences>) =>
      commit(
        (value) => ({
          ...value,
          preferences: { ...value.preferences, ...preferences },
        }),
        true,
      ),
  };
}
export type LibraryStore = ReturnType<typeof useLibrary>;
