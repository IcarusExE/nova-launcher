import { useI18n, pageKeys } from '../i18n';
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Compass,
  Home,
  Minus,
  Search,
  Settings,
  ShieldCheck,
  Square,
  UserRound,
  X,
} from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { ReactNode } from 'react';
import type { Page } from '../lib/types';

const navigation = [
  { page: 'home', label: 'Home', icon: Home },
  { page: 'discover', label: 'Discover', icon: Compass },
  { page: 'library', label: 'Library', icon: BookOpen },
  { page: 'profile', label: 'Profile', icon: UserRound },
] as const;
export function Shell({
  page,
  navigate,
  onSearch,
  favoriteCount,
  children,
  onError,
}: {
  page: Page;
  navigate: (page: Page) => void;
  onSearch: (value: string) => void;
  favoriteCount: number;
  children: ReactNode;
  onError: (message: string) => void;
}) {
  const { t, number } = useI18n();
  const windowAction = async (
    action: 'minimize' | 'toggleMaximize' | 'close',
  ) => {
    try {
      await getCurrentWindow()[action]();
    } catch {
      onError(
        'The window action failed. Use your desktop window manager to control the window.',
      );
    }
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => navigate('home')}
          aria-label={t('Nova Launcher home')}
        >
          <img src="/nova.svg" alt="" />
          <span>
            nova<span className="brand-subtitle">LAUNCHER</span>
          </span>
        </button>
        <div className="workspace-label">{t('Your playground.')}</div>
        <nav aria-label={t('Main navigation')}>
          {navigation.map(({ page: target, label, icon: Icon }) => (
            <button
              key={target}
              aria-label={t(label)}
              title={t(label)}
              className={`nav-item ${page === target ? 'active' : ''}`}
              aria-current={page === target ? 'page' : undefined}
              onClick={() => navigate(target)}
            >
              <Icon size={19} />
              <span>{t(label)}</span>
              {target === 'library' && favoriteCount > 0 && (
                <span className="nav-count">{number(favoriteCount)}</span>
              )}
            </button>
          ))}
          <div className="nav-divider" />
          <button
            className={`nav-item ${page === 'settings' ? 'active' : ''}`}
            aria-label={t('Settings')}
            title={t('Settings')}
            aria-current={page === 'settings' ? 'page' : undefined}
            onClick={() => navigate('settings')}
          >
            <Settings size={19} />
            <span>{t('Settings')}</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <ShieldCheck size={19} />
            <div>
              <strong>{t('Yours. Locally.')}</strong>
              <span>{t('No account required')}</span>
            </div>
          </div>
          <button
            className="guest-button"
            aria-label={t('Open public profiles')}
            title={t('Public profiles')}
            onClick={() => navigate('profile')}
          >
            <div className="guest-avatar">
              <UserRound size={20} />
            </div>
            <span>
              <strong>{t('Guest explorer')}</strong>
              <small>{t('Public profiles only')}</small>
            </span>
            <ChevronRight size={16} />
          </button>
          <div className="sidebar-version">
            <span className="status-dot violet" />
            {t('Native preview')}
            <span>v0.1.0</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-drag" data-tauri-drag-region>
            <span>Nova Launcher</span>
            <span className="header-divider">/</span>
            <span className="topbar-page">{t(pageKeys[page])}</span>
          </div>
          <button
            className="global-search"
            aria-label={t('Find your next experience')}
            onClick={() => {
              navigate('discover');
              onSearch('');
              requestAnimationFrame(() =>
                document
                  .querySelector<HTMLInputElement>('#discover-search')
                  ?.focus(),
              );
            }}
          >
            <Search size={16} />
            <span>{t('Find your next experience')}</span>
            <kbd>Ctrl K</kbd>
          </button>
          <a
            className="community-link"
            href="https://www.roblox.com/discover"
            target="_blank"
            rel="noreferrer"
          >
            Roblox
            <ArrowUpRight size={14} />
          </a>
          {isTauri() && (
            <div className="window-controls">
              <button
                aria-label={t('Minimize window')}
                onClick={() => void windowAction('minimize')}
              >
                <Minus size={16} />
              </button>
              <button
                aria-label={t('Maximize or restore window')}
                onClick={() => void windowAction('toggleMaximize')}
              >
                <Square size={13} />
              </button>
              <button
                aria-label={t('Close window')}
                onClick={() => void windowAction('close')}
              >
                <X size={17} />
              </button>
            </div>
          )}
        </header>
        <main id="main-content">{children}</main>
        <footer className="app-footer">
          <span>
            <span className="status-dot violet" />
            {t('Public data preview')}
          </span>
          <span>{t('Independent launcher. Not affiliated with Roblox.')}</span>
        </footer>
      </div>
    </div>
  );
}
