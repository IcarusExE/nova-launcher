import {
  AlertCircle,
  Check,
  CircleHelp,
  Monitor,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import type { AdapterStatus } from '../lib/types';
import { Loading } from './ui';
import { useLauncher } from '../hooks/useLauncher';
import { LaunchFeedback } from './LaunchFeedback';

export interface InstallationState {
  statuses: AdapterStatus[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}
export function InstallationPanel({
  state,
  detailed = false,
}: {
  state: InstallationState;
  detailed?: boolean;
}) {
  const launcher = useLauncher();
  return (
    <section className="panel installation-panel">
      <div className="panel-heading">
        <div className="panel-icon">
          <Monitor size={19} />
        </div>
        <div>
          <h3>Roblox on your device</h3>
          <p>Native client availability</p>
        </div>
        <button
          className="icon-button ml-auto"
          aria-label="Rescan installations"
          disabled={state.loading || launcher.busy}
          onClick={state.refresh}
        >
          <RefreshCw size={15} className={state.loading ? 'spin' : ''} />
        </button>
      </div>
      {state.loading ? (
        <Loading label="Checking installations…" />
      ) : state.error ? (
        <div className="inline-error" role="alert">
          <AlertCircle size={18} />
          {state.error}
          <button className="text-button" onClick={state.refresh}>
            Retry
          </button>
        </div>
      ) : (
        <div className="adapter-list">
          {state.statuses.map((adapter) => (
            <div className="adapter" key={adapter.id}>
              <div className="adapter-platform">
                {adapter.id === 'sober' ? (
                  <Terminal size={21} />
                ) : (
                  <Monitor size={21} />
                )}
              </div>
              <div>
                <strong>{adapter.name}</strong>
                <span>
                  {adapter.installation === 'detected'
                    ? 'Installation found'
                    : adapter.installation === 'notFound'
                      ? 'Not installed'
                      : adapter.installation === 'unsupported'
                        ? adapter.capabilities.detect
                          ? 'Unsupported installation'
                          : 'Different platform'
                        : adapter.capabilities.detect
                          ? 'Status unavailable'
                          : 'Desktop app required'}
                </span>
                {detailed && (
                  <p className="adapter-detail">
                    {adapter.detail}
                    {adapter.location && <code>{adapter.location}</code>}
                  </p>
                )}
              </div>
              {adapter.installation === 'detected' ? (
                <Check className="success ml-auto" size={16} />
              ) : (
                <span className="status-dot ml-auto" />
              )}
            </div>
          ))}
        </div>
      )}
      <button
        className="button primary launch-client"
        disabled={!launcher.canLaunch || launcher.busy}
        onClick={() => void launcher.launchClient()}
      >
        <Monitor size={16} />
        {launcher.busy && launcher.lastAction === 'launchClient'
          ? 'Requesting launch…'
          : 'Launch Roblox'}
      </button>
      <LaunchFeedback action="launchClient" />
      {!state.loading &&
        !state.error &&
        !launcher.canLaunch &&
        launcher.selected && (
          <p className="adapter-detail">{launcher.selected.detail}</p>
        )}
      <p className="panel-footnote">
        <CircleHelp size={13} />
        {launcher.selected
          ? `Selected: ${launcher.selected.name}. ${!launcher.selected.capabilities.detect ? 'This client is unavailable on this operating system.' : launcher.selected.id === 'windows' && !launcher.selected.runtimeVerified ? 'Windows runtime remains unverified.' : 'Launch requests do not confirm client startup.'}`
          : launcher.desktop
            ? 'Client launching is unsupported on this operating system.'
            : 'Launch requests require the desktop app.'}
      </p>
    </section>
  );
}
