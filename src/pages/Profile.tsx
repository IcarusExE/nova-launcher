import { useI18n } from '../i18n';
import {
  ArrowUpRight,
  CalendarDays,
  LoaderCircle,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EmptyState, DataBadge, Loading, RobloxImage } from '../components/ui';
import { LocalizedError } from '../components/LocalizedError';
import { apiError, robloxRequest } from '../lib/roblox';
import type { ApiError, PublicProfile, UserPage } from '../lib/roblox';

export function Profile() {
  const { t, date } = useI18n();
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [page, setPage] = useState<(UserPage & { query: string }) | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [error, setError] = useState<ApiError | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const version = useRef(0);
  const mounted = useRef(true);
  const invalidate = (value: string) => {
    ++version.current;
    setQuery(value);
    setSearched('');
    setStatus('idle');
    setProfile(null);
    setPage(null);
    setError(null);
  };
  const cooldown = (seconds: number) => {
    if (mounted.current && seconds > 0) {
      setNow(Date.now());
      setCooldownUntil((previous) =>
        Math.max(previous, Date.now() + seconds * 1000),
      );
    }
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      ++version.current;
    };
  }, []);
  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= cooldownUntil) setCooldownUntil(0);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil]);
  const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const run = async (
    mode: 'exact' | 'search' | 'user',
    value: string,
    cursor: string | null = null,
  ) => {
    if (cursor && (page?.query !== value || query.trim() !== value)) return;
    const current = ++version.current;
    setStatus('loading');
    setError(null);
    setProfile(null);
    if (mode !== 'user') {
      setSearched(value);
      setProfile(null);
      if (!cursor) setPage(null);
    }
    try {
      if (mode === 'search') {
        const result = await robloxRequest(
          { action: 'searchUsers', keyword: value, cursor },
          'users',
        );
        cooldown(result.retryAfterSeconds);
        if (current !== version.current) return;
        setPage((previous) => ({
          ...result,
          query: value,
          users:
            cursor && previous?.query === value
              ? [
                  ...previous.users,
                  ...result.users.filter(
                    (u) => !previous.users.some((p) => p.id === u.id),
                  ),
                ]
              : result.users,
        }));
      } else {
        const result =
          mode === 'exact'
            ? await robloxRequest(
                { action: 'lookupUsername', username: value },
                'profile',
              )
            : await robloxRequest(
                { action: 'lookupUser', userId: value },
                'profile',
              );
        if (current !== version.current) return;
        setProfile(result);
        if (mode === 'exact') setPage(null);
      }
    } catch (e) {
      const issue = apiError(e);
      if (mode === 'search') cooldown(issue.retryAfterSeconds ?? 0);
      if (current !== version.current) return;
      setError(issue);
    } finally {
      if (current === version.current) setStatus('ready');
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t('A face behind the username.')}</h1>
          <p>{t('Explore public profiles. Your credentials stay yours.')}</p>
        </div>
        <DataBadge />
      </div>
      <div className="profile-layout">
        <div>
          <form
            className="profile-search"
            onSubmit={(e) => {
              e.preventDefault();
              void run('exact', query.trim());
            }}
          >
            <div className="search-input">
              <Search size={19} />
              <input
                aria-label={t('Roblox username')}
                data-profile-input
                placeholder={t('Enter a Roblox username…')}
                value={query}
                onChange={(e) => {
                  e.target.setCustomValidity('');
                  invalidate(e.target.value);
                }}
                onInvalid={(e) =>
                  e.currentTarget.setCustomValidity(
                    t('Use 3–20 letters, numbers, or underscores'),
                  )
                }
                maxLength={20}
                pattern="[A-Za-z0-9_]{3,20}"
                title={t('Use 3–20 letters, numbers, or underscores')}
                required
              />
              {query && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t('Clear username')}
                  onClick={() => {
                    invalidate('');
                    document
                      .querySelector<HTMLInputElement>('[data-profile-input]')
                      ?.focus();
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button className="button primary" type="submit">
              {t('Search profile')}
            </button>
            <button
              className="button"
              type="button"
              disabled={
                remaining > 0 || !/^[A-Za-z0-9_]{3,20}$/.test(query.trim())
              }
              onClick={() => void run('search', query.trim())}
            >
              {t('Find users')}
            </button>
          </form>
          <p className="profile-hint">
            {t(
              'Search profile resolves a username. Find users searches public matches, 10 per page. Roblox may limit searches to one request per minute.',
            )}
            {remaining > 0 && (
              <span role="status">
                {t('search.cooldown', { count: remaining })}
              </span>
            )}
          </p>
          <section
            className="panel profile-result"
            aria-live="polite"
            aria-busy={status === 'loading'}
          >
            {status === 'loading' && !page && (
              <Loading label={t('Loading public Roblox data…')} />
            )}
            {error && (
              <div className="inline-error" role="alert">
                <LocalizedError error={error} />
              </div>
            )}
            {status === 'idle' && !profile && !page && (
              <EmptyState
                title={t('Meet someone new')}
                icon={<UserRound size={32} />}
              >
                {t('Look up a public username. No Roblox login is required.')}
              </EmptyState>
            )}
            {status === 'ready' &&
              !error &&
              !profile &&
              !page?.users.length && (
                <EmptyState title={t('No public profiles found')}>
                  {t('Roblox returned no public match for “{query}”.', {
                    query: searched,
                  })}
                </EmptyState>
              )}
            {page && (
              <div className="user-results">
                <h3>
                  {t('Public matches for “{query}”', { query: page.query })}
                  {status === 'loading' && (
                    <LoaderCircle
                      size={14}
                      className="spin"
                      role="status"
                      aria-label={t('Loading public Roblox data…')}
                    />
                  )}
                </h3>
                {page.users.map((user) => (
                  <button
                    className="user-result"
                    key={user.id}
                    onClick={() => void run('user', user.id)}
                  >
                    <UserRound size={18} />
                    <span>
                      <strong>{user.displayName}</strong>
                      <span>
                        @{user.username}
                        {user.verified ? ` · ${t('Verified')}` : ''}
                      </span>
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
                {page.nextCursor && (
                  <button
                    className="button"
                    disabled={remaining > 0 || status === 'loading'}
                    onClick={() =>
                      void run('search', page.query, page.nextCursor)
                    }
                  >
                    {t('More users')}
                  </button>
                )}
              </div>
            )}
            {profile && (
              <div className="public-profile">
                <DataBadge>
                  {t('Public Roblox profile · API preview')}
                </DataBadge>
                <div className="profile-identity">
                  <div className="profile-avatar">
                    <RobloxImage src={profile.avatarUrl} />
                  </div>
                  <div>
                    <h2>
                      {profile.displayName}
                      {profile.verified && (
                        <ShieldCheck
                          size={19}
                          aria-label={t('Verified account')}
                        />
                      )}
                    </h2>
                    <p>@{profile.username}</p>
                    <span className="profile-joined">
                      <CalendarDays size={14} />
                      {t('Joined {date}', { date: date(profile.createdAt) })}
                    </span>
                  </div>
                </div>
                <p className="public-description">
                  {profile.description || t('No public biography.')}
                </p>
                <div className="profile-stats">
                  <div>
                    <strong>{profile.id}</strong>
                    <span>{t('User ID')}</span>
                  </div>
                  <div>
                    <strong>
                      {profile.isBanned ? t('Banned') : t('Public')}
                    </strong>
                    <span>{t('Account status')}</span>
                  </div>
                </div>
                {profile.warnings.map((warning, index) => (
                  <div className="muted" key={index}>
                    <LocalizedError error={warning} />
                  </div>
                ))}
                <p className="quiet-label">
                  {t('Observed {date}', {
                    date: date(profile.observedAt, true),
                  })}
                </p>
                <a
                  className="button primary"
                  href={`https://www.roblox.com/users/${profile.id}/profile`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('Open public Roblox profile')}
                  <ArrowUpRight size={16} />
                </a>
              </div>
            )}
          </section>
        </div>
        <aside>
          <section className="panel privacy-panel">
            <div className="panel-icon">
              <ShieldCheck size={22} />
            </div>
            <h3>{t('Public by design.')}</h3>
            <p>
              {t(
                'Nova never asks for your Roblox password, authentication cookies, or login token.',
              )}
            </p>
            <div className="privacy-point">
              <Users size={16} />
              <span>{t('Public information only')}</span>
            </div>
            <div className="privacy-point">
              <ArrowUpRight size={16} />
              <span>{t('Account actions stay on Roblox')}</span>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
