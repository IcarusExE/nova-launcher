import {
  ArrowUpRight,
  CalendarDays,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EmptyState, DataBadge, Loading, RobloxImage } from '../components/ui';
import { apiError, robloxRequest } from '../lib/roblox';
import type { ApiError, PublicProfile, UserPage } from '../lib/roblox';

export function Profile() {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [page, setPage] = useState<UserPage | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [error, setError] = useState<ApiError | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const version = useRef(0);
  useEffect(
    () => () => {
      ++version.current;
    },
    [],
  );
  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil]);
  const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const run = async (
    mode: 'exact' | 'search' | 'user',
    value: string,
    cursor: string | null = null,
  ) => {
    const current = ++version.current;
    setStatus('loading');
    setError(null);
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
        if (current !== version.current) return;
        setPage((previous) => ({
          ...result,
          users:
            cursor && previous
              ? [
                  ...previous.users,
                  ...result.users.filter(
                    (u) => !previous.users.some((p) => p.id === u.id),
                  ),
                ]
              : result.users,
        }));
        setNow(Date.now());
        setCooldownUntil(Date.now() + result.retryAfterSeconds * 1000);
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
      if (current !== version.current) return;
      const issue = apiError(e);
      setError(issue);
      if (issue.retryAfterSeconds) {
        setNow(Date.now());
        setCooldownUntil(Date.now() + issue.retryAfterSeconds * 1000);
      }
    } finally {
      if (current === version.current) setStatus('ready');
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>A face behind the username.</h1>
          <p>Explore public profiles. Your credentials stay yours.</p>
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
                aria-label="Roblox username"
                placeholder="Enter a Roblox username…"
                value={query}
                onChange={(e) => {
                  ++version.current;
                  setStatus('idle');
                  setError(null);
                  setQuery(e.target.value);
                }}
                maxLength={20}
                pattern="[A-Za-z0-9_]{3,20}"
                title="Use 3–20 letters, numbers, or underscores"
                required
              />
              {query && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Clear username"
                  onClick={() => {
                    ++version.current;
                    setQuery('');
                    setStatus('idle');
                    setProfile(null);
                    setPage(null);
                    setError(null);
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button className="button primary" type="submit">
              Search profile
            </button>
            <button
              className="button"
              type="button"
              disabled={
                remaining > 0 || !/^[A-Za-z0-9_]{3,20}$/.test(query.trim())
              }
              onClick={() => void run('search', query.trim())}
            >
              Find users
            </button>
          </form>
          <p className="profile-hint">
            Search profile resolves a username. Find users searches public
            matches, 10 per page. Roblox may limit searches to one request per
            minute.
            {remaining > 0 && (
              <span role="status"> Search available in {remaining}s.</span>
            )}
          </p>
          <section className="panel profile-result" aria-live="polite">
            {status === 'loading' && (
              <Loading label="Loading public Roblox data…" />
            )}
            {error && (
              <div className="inline-error" role="alert">
                <strong>
                  {error.code === 'offline'
                    ? 'Offline'
                    : error.code === 'desktopRequired'
                      ? 'Desktop app required'
                      : 'Lookup unavailable'}
                </strong>{' '}
                · {error.message}
              </div>
            )}
            {status === 'idle' && !profile && !page && (
              <EmptyState
                title="Meet someone new"
                icon={<UserRound size={32} />}
              >
                Look up a public username. No Roblox login is required.
              </EmptyState>
            )}
            {status === 'ready' &&
              !error &&
              !profile &&
              !page?.users.length && (
                <EmptyState title="No public profiles found">
                  Roblox returned no public match for “{searched}”.
                </EmptyState>
              )}
            {page && (
              <div className="user-results">
                <h3>Public matches for “{searched}”</h3>
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
                        {user.verified ? ' · Verified' : ''}
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
                      void run('search', searched, page.nextCursor)
                    }
                  >
                    More users
                  </button>
                )}
              </div>
            )}
            {profile && (
              <div className="public-profile">
                <DataBadge>Public Roblox profile · API preview</DataBadge>
                <div className="profile-identity">
                  <div className="profile-avatar">
                    <RobloxImage src={profile.avatarUrl} />
                  </div>
                  <div>
                    <h2>
                      {profile.displayName}
                      {profile.verified && (
                        <ShieldCheck size={19} aria-label="Verified account" />
                      )}
                    </h2>
                    <p>@{profile.username}</p>
                    <span className="profile-joined">
                      <CalendarDays size={14} />
                      Joined{' '}
                      {Number.isNaN(Date.parse(profile.createdAt))
                        ? 'date unavailable'
                        : new Date(profile.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <p className="public-description">
                  {profile.description || 'No public biography.'}
                </p>
                <div className="profile-stats">
                  <div>
                    <strong>{profile.id}</strong>
                    <span>User ID</span>
                  </div>
                  <div>
                    <strong>{profile.isBanned ? 'Banned' : 'Public'}</strong>
                    <span>Account status</span>
                  </div>
                </div>
                {profile.warnings.map((warning, index) => (
                  <p className="muted" key={index}>
                    {warning.message}
                  </p>
                ))}
                <p className="quiet-label">
                  Observed {new Date(profile.observedAt).toLocaleString()}
                </p>
                <a
                  className="button primary"
                  href={`https://www.roblox.com/users/${profile.id}/profile`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open public Roblox profile
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
            <h3>Public by design.</h3>
            <p>
              Nova never asks for your Roblox password, authentication cookies,
              or login token.
            </p>
            <div className="privacy-point">
              <Users size={16} />
              <span>Public information only</span>
            </div>
            <div className="privacy-point">
              <ArrowUpRight size={16} />
              <span>Account actions stay on Roblox</span>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
