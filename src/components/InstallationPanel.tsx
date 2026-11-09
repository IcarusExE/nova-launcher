import { useI18n } from '../i18n';
import {
  AlertCircle,
  Check,
  CircleHelp,
  Monitor,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import type { AdapterStatus } from '../lib/types';
import { Diagnostics, LocalizedError } from './LocalizedError';
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
  const { t } = useI18n();
  const launcher = useLauncher();
  return (
    <section className="panel installation-panel">
      <div className="panel-heading">
        <div className="panel-icon">
          <Monitor size={19} />
        </div>
        <div>
          <h3>{t('Roblox on your device')}</h3>
          <p>{t('Native client availability')}</p>
        </div>
        <button
          className="icon-button ml-auto"
          aria-label={t('Rescan installations')}
          disabled={state.loading || launcher.busy}
          onClick={state.refresh}
        >
          <RefreshCw size={15} className={state.loading ? 'spin' : ''} />
        </button>
      </div>
      {state.loading ? (
        <Loading label={t('Checking installations…')} />
      ) : state.error ? (
        <div className="inline-error" role="alert">
          <AlertCircle size={18} />
          <LocalizedError error={state.error} context="detection" />
          <button className="text-button" onClick={state.refresh}>
            {t('Retry')}
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
                    ? t('Installation found')
                    : adapter.installation === 'notFound'
                      ? t('Not installed')
                      : adapter.installation === 'unsupported'
                        ? adapter.capabilities.detect
                          ? t('Unsupported installation')
                          : t('Different platform')
                        : adapter.capabilities.detect
                          ? t('Status unavailable')
                          : t('Desktop app required')}
                </span>
                {detailed && (
                  <div className="adapter-detail">
                    {adapter.installation === 'detected'
                      ? t(
                          adapter.id === 'sober'
                            ? 'Detected Sober. Experience requests open the official Roblox website.'
                            : 'Detected official Windows Player. Runtime verification is still required.',
                        )
                      : !adapter.capabilities.detect
                        ? t(
                            adapter.id === 'sober'
                              ? 'Sober is available only on Linux.'
                              : 'Windows Player is available only on Windows.',
                          )
                        : t(
                            'Client detection is unavailable. Rescan and inspect diagnostics.',
                          )}
                    <Diagnostics detail={adapter.detail} />
                    {adapter.location && <code>{adapter.location}</code>}
                  </div>
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
          ? t('Requesting launch…')
          : t('Launch Roblox')}
      </button>
      <LaunchFeedback action="launchClient" />
      {!state.loading &&
        !state.error &&
        !launcher.canLaunch &&
        launcher.selected && (
          <div className="adapter-detail">
            <Diagnostics detail={launcher.selected.detail} />
          </div>
        )}
      <p className="panel-footnote">
        <CircleHelp size={13} />
        {launcher.selected
          ? t('Selected: {client}. {detail}', {
              client: launcher.selected.name,
              detail: !launcher.selected.capabilities.detect
                ? t('This client is unavailable on this operating system.')
                : launcher.selected.id === 'windows' &&
                    !launcher.selected.runtimeVerified
                  ? t('Windows runtime remains unverified.')
                  : t('Launch requests do not confirm client startup.'),
            })
          : launcher.desktop
            ? t('Client launching is unsupported on this operating system.')
            : t('Launch requests require the desktop app.')}
      </p>
    </section>
  );
}
