import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { detectAdapters } from '../lib/storage';
import {
  desktopAvailable,
  dispatchRequest,
  errorMessage,
  readLaunchHistory,
} from '../lib/launcher';
import type {
  AcceptedRequest,
  AdapterStatus,
  LaunchReceipt,
  LaunchRequest,
  Preferences,
} from '../lib/types';

export function useLaunchController(
  preference: Preferences['preferredAdapter'],
  preferencesReady: boolean,
) {
  const [statuses, setStatuses] = useState<AdapterStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [lastAction, setLastAction] = useState<LaunchRequest['action'] | null>(
    null,
  );
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<LaunchReceipt | null>(null);
  const [history, setHistory] = useState<AcceptedRequest[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatuses(await detectAdapters());
    } catch (e) {
      setError(
        errorMessage(e, 'Could not check installations. Rescan to try again.'),
      );
    } finally {
      setLoading(false);
    }
  }, []);
  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      setHistory(await readLaunchHistory());
    } catch (e) {
      setHistoryError(
        errorMessage(
          e,
          'Could not read saved requests. Retry to check local storage.',
        ),
      );
    } finally {
      setHistoryLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    void refreshHistory();
  }, [refresh, refreshHistory]);
  const selected =
    preference === 'auto'
      ? statuses.find((s) => s.capabilities.detect)
      : statuses.find((s) => s.id === preference);
  const send = async (request: LaunchRequest) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setLastAction(request.action);
    setLaunchError(null);
    setReceipt(null);
    try {
      const result = await dispatchRequest(request);
      setReceipt(result);
      await refreshHistory();
    } catch (e) {
      setLaunchError(errorMessage(e));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return {
    statuses,
    loading,
    error,
    refresh,
    selected,
    desktop: desktopAvailable(),
    busy,
    lastAction,
    launchError,
    receipt,
    history,
    historyLoading,
    historyError,
    refreshHistory,
    canLaunch:
      preferencesReady &&
      !loading &&
      !error &&
      selected?.installation === 'detected' &&
      selected.capabilities.launch,
    launchClient: () => send({ action: 'launchClient', adapter: preference }),
    openExperience: (placeId: string) =>
      send({ action: 'openExperience', placeId }),
  };
}
export type Launcher = ReturnType<typeof useLaunchController>;
export const LauncherContext = createContext<Launcher | null>(null);
export function useLauncher() {
  const value = useContext(LauncherContext);
  if (!value) throw new Error('Launcher provider is missing.');
  return value;
}
