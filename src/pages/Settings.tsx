import { useI18n, accentKeys } from '../i18n';
import {
  Check,
  CircleHelp,
  Download,
  Github,
  Info,
  Monitor,
  Palette,
  Puzzle,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import type { LibraryStore } from '../hooks/useLibrary';
import type { Page, Preferences } from '../lib/types';
import { storageLabel } from '../lib/storage';
import { InstallationPanel } from '../components/InstallationPanel';
import type { InstallationState } from '../components/InstallationPanel';
import type { ReactNode } from 'react';

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="setting-row">
      <div>
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={`toggle ${checked ? 'on' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}
const tabs = [
  { name: 'Appearance', icon: Palette },
  { name: 'Launcher', icon: Monitor },
  { name: 'Integrations', icon: Puzzle },
  { name: 'Updates', icon: Download },
  { name: 'About', icon: Info },
] as const;
export function Settings({
  library,
  installation,
}: {
  library: LibraryStore;
  installation: InstallationState;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState('Appearance');
  const prefs = library.data.preferences;
  const disabled = !library.ready;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t('Make yourself at home.')}</h1>
          <p>
            {t('A few thoughtful settings. A launcher that feels like yours.')}
          </p>
        </div>
        <span className="storage-label settings-storage">
          <span>{t(storageLabel)}</span>
          <span className="save-status" role="status">
            {!library.ready
              ? library.loading
                ? t('Loading saved data…')
                : t('Storage unavailable')
              : library.saving
                ? t('Saving…')
                : library.error
                  ? t('Save failed')
                  : t('Saved on this device')}
          </span>
        </span>
      </div>
      <div
        className="settings-tabs"
        role="tablist"
        aria-label={t('Settings categories')}
      >
        {tabs.map(({ name, icon: Icon }) => (
          <button
            id={`tab-${name}`}
            key={name}
            role="tab"
            aria-selected={tab === name}
            aria-controls="settings-panel"
            className={tab === name ? 'active' : ''}
            onClick={() => setTab(name)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const index =
                  (tabs.findIndex((t) => t.name === name) +
                    (e.key === 'ArrowRight' ? 1 : -1) +
                    tabs.length) %
                  tabs.length;
                setTab(tabs[index].name);
                document.getElementById(`tab-${tabs[index].name}`)?.focus();
              }
            }}
            tabIndex={tab === name ? 0 : -1}
          >
            <Icon size={17} />
            {t(name)}
          </button>
        ))}
      </div>
      <div
        id="settings-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="settings-layout"
      >
        <div className="settings-content">
          {tab === 'Appearance' && (
            <>
              <section className="panel settings-panel">
                <div className="panel-heading">
                  <Palette size={21} />
                  <div>
                    <h3>{t('Look & feel')}</h3>
                    <p>{t('A quieter space for your next adventure.')}</p>
                  </div>
                </div>
                <SettingRow
                  title={t('Language')}
                  description={t(
                    'Choose the interface language. Roblox content keeps its original language.',
                  )}
                >
                  <select
                    aria-label={t('Language')}
                    value={prefs.language}
                    disabled={disabled}
                    onChange={(e) =>
                      void library.updatePreferences({
                        language: e.target.value as Preferences['language'],
                      })
                    }
                  >
                    <option value="system">{t('System default')}</option>
                    <option value="tr" lang="tr">
                      Türkçe
                    </option>
                    <option value="en" lang="en">
                      English
                    </option>
                  </select>
                </SettingRow>
                <SettingRow
                  title={t('Color theme')}
                  description={t('Choose your look, or follow your system.')}
                >
                  <select
                    aria-label={t('Color theme')}
                    disabled={disabled}
                    value={prefs.theme}
                    onChange={(e) =>
                      void library.updatePreferences({
                        theme: e.target.value as Preferences['theme'],
                      })
                    }
                  >
                    <option value="dark">{t('Nova Dark')}</option>
                    <option value="light">{t('Light')}</option>
                    <option value="system">{t('System')}</option>
                  </select>
                </SettingRow>
                <SettingRow
                  title={t('Accent color')}
                  description={t('A personal touch, across your launcher.')}
                >
                  <div
                    className="accent-options"
                    role="radiogroup"
                    aria-label={t('Accent color')}
                  >
                    {(['violet', 'blue', 'teal', 'amber'] as const).map(
                      (accent, index, colors) => (
                        <button
                          key={accent}
                          type="button"
                          role="radio"
                          aria-checked={prefs.accent === accent}
                          aria-label={t(accentKeys[accent])}
                          title={t(accentKeys[accent])}
                          className="accent-swatch"
                          data-accent={accent}
                          disabled={disabled}
                          tabIndex={prefs.accent === accent ? 0 : -1}
                          onClick={() =>
                            void library.updatePreferences({ accent })
                          }
                          onKeyDown={(e) => {
                            let next: number;
                            if (e.key === 'Home') next = 0;
                            else if (e.key === 'End') next = colors.length - 1;
                            else if (
                              [
                                'ArrowLeft',
                                'ArrowUp',
                                'ArrowRight',
                                'ArrowDown',
                              ].includes(e.key)
                            )
                              next =
                                (index +
                                  (['ArrowLeft', 'ArrowUp'].includes(e.key)
                                    ? -1
                                    : 1) +
                                  colors.length) %
                                colors.length;
                            else return;
                            e.preventDefault();
                            (
                              e.currentTarget.parentElement?.children[
                                next
                              ] as HTMLElement
                            )?.focus();
                            void library.updatePreferences({
                              accent: colors[next],
                            });
                          }}
                        >
                          {prefs.accent === accent && (
                            <Check size={15} aria-hidden="true" />
                          )}
                        </button>
                      ),
                    )}
                  </div>
                </SettingRow>
                <SettingRow
                  title={t('Compact game cards')}
                  description={t('Fit more experiences into your library.')}
                >
                  <Toggle
                    checked={prefs.compactCards}
                    label={t('Compact game cards')}
                    disabled={disabled}
                    onChange={(compactCards) =>
                      void library.updatePreferences({ compactCards })
                    }
                  />
                </SettingRow>
                <SettingRow
                  title={t('Reduce motion')}
                  description={t(
                    'Minimize transitions. System reduced motion is always respected.',
                  )}
                >
                  <Toggle
                    checked={prefs.reduceMotion}
                    label={t('Reduce motion')}
                    disabled={disabled}
                    onChange={(reduceMotion) =>
                      void library.updatePreferences({ reduceMotion })
                    }
                  />
                </SettingRow>
              </section>
              <div className="notice">
                <CircleHelp size={18} />
                <span>
                  {t(
                    "Appearance preferences are saved on this device. Your system's reduced motion setting is always respected.",
                  )}
                </span>
              </div>
            </>
          )}
          {tab === 'Launcher' && (
            <>
              <section className="panel settings-panel">
                <div className="panel-heading">
                  <Monitor size={21} />
                  <div>
                    <h3>{t('Your launcher')}</h3>
                    <p>{t('Ready for your desktop.')}</p>
                  </div>
                </div>
                <SettingRow
                  title={t('Start page')}
                  description={t('Where Nova opens next time.')}
                >
                  <select
                    aria-label={t('Start page')}
                    disabled={disabled}
                    value={prefs.startPage}
                    onChange={(e) =>
                      void library.updatePreferences({
                        startPage: e.target.value as Page,
                      })
                    }
                  >
                    <option value="home">{t('Home')}</option>
                    <option value="discover">{t('Discover')}</option>
                    <option value="library">{t('Library')}</option>
                    <option value="profile">{t('Profile')}</option>
                    <option value="settings">{t('Settings')}</option>
                  </select>
                </SettingRow>
                <SettingRow
                  title={t('Preferred client')}
                  description={t(
                    'Selects the client used by Launch Roblox. Experience pages open in your browser.',
                  )}
                >
                  <select
                    aria-label={t('Preferred client')}
                    disabled={disabled}
                    value={prefs.preferredAdapter}
                    onChange={(e) =>
                      void library.updatePreferences({
                        preferredAdapter: e.target
                          .value as Preferences['preferredAdapter'],
                      })
                    }
                  >
                    <option value="auto">{t('Automatic')}</option>
                    <option value="sober">{t('Linux Sober')}</option>
                    <option value="windows">{t('Windows Player')}</option>
                  </select>
                </SettingRow>
              </section>
              <InstallationPanel state={installation} detailed />
            </>
          )}
          {tab === 'Integrations' && (
            <section className="panel settings-panel">
              <div className="panel-heading">
                <Puzzle size={22} />
                <div>
                  <h3>{t('Discord presence')}</h3>
                  <p>{t('Planned for a future milestone')}</p>
                </div>
                <span className="tag ml-auto">{t('Not connected')}</span>
              </div>
              <p className="settings-paragraph">
                {t(
                  "Share what you're playing with friends, when you choose. Discord RPC is not implemented, and Nova does not connect to Discord.",
                )}
              </p>
              <div className="notice">
                <ShieldCheck size={18} />
                <span>
                  {t('There are no background integration services running.')}
                </span>
              </div>
            </section>
          )}
          {tab === 'Updates' && (
            <section className="panel settings-panel">
              <div className="panel-heading">
                <Download size={22} />
                <div>
                  <h3>{t('Application updates')}</h3>
                  <p>{t('Manual builds for now')}</p>
                </div>
                <span className="tag ml-auto">{t('Coming later')}</span>
              </div>
              <p className="settings-paragraph">
                {t(
                  'Automatic updates and update checks are not implemented in this milestone. Nova does not contact an update server.',
                )}
              </p>
              <SettingRow
                title={t('Installed version')}
                description={t(
                  'Native launch preview · Windows runtime unverified',
                )}
              >
                <span className="version-text">0.1.0</span>
              </SettingRow>
            </section>
          )}
          {tab === 'About' && (
            <section className="panel settings-panel about-panel">
              <img src="/nova.svg" alt="Nova" />
              <h2>Nova Launcher</h2>
              <p>{t('A considered home for your Roblox experiences.')}</p>
              <span className="tag">
                {t('Version 0.1.0 · Public API preview')}
              </span>
              <p>
                {t(
                  'Built with Tauri 2, Rust, React, and TypeScript. Local desktop data is stored in SQLite. Open source under the MIT license.',
                )}
              </p>
              <div className="notice">
                <Github size={19} />
                <span>
                  {t(
                    'Independent and community built. Nova is not affiliated with Roblox Corporation or the Sober project.',
                  )}
                </span>
              </div>
            </section>
          )}
        </div>
        <aside className="panel settings-note">
          <ShieldCheck size={22} />
          <h3>
            {t('Small footprint.')}
            <br />
            {t('Clear boundaries.')}
          </h3>
          <p>
            {t(
              'Preferences and favorites stay on your device. No Roblox credentials, no executable modifications, no injection.',
            )}
          </p>
          <span className="quiet-label">
            {t('Designed for Windows & Linux')}
          </span>
        </aside>
      </div>
    </>
  );
}
