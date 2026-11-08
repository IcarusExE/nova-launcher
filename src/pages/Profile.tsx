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
import { EmptyState, FixtureBadge, Loading } from '../components/ui';

type SearchState = 'idle' | 'loading' | 'found' | 'empty' | 'error';
export function Profile() {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [state, setState] = useState<SearchState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const search = () => {
    clearTimeout(timer.current);
    setSearched(query.trim());
    setState('loading');
    timer.current = setTimeout(
      () =>
        setState(query.trim().toLowerCase() === 'roblox' ? 'found' : 'empty'),
      450,
    );
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>A face behind the username.</h1>
          <p>Explore public profiles. Your credentials stay yours.</p>
        </div>
        <FixtureBadge>Profile preview</FixtureBadge>
      </div>
      <div className="profile-layout">
        <div>
          <form
            className="profile-search"
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
          >
            <div className="search-input">
              <Search size={19} />
              <input
                aria-label="Roblox username"
                placeholder="Enter a Roblox username…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
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
                  onClick={() => setQuery('')}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              className="button primary"
              type="submit"
              disabled={state === 'loading'}
            >
              Search profile
            </button>
          </form>
          <p className="profile-hint">
            Development preview: try{' '}
            <button className="text-button" onClick={() => setQuery('Roblox')}>
              Roblox
            </button>
            . Other usernames show the empty state.
          </p>
          <section className="panel profile-result" aria-live="polite">
            {state === 'loading' ? (
              <Loading label="Loading sample public profile…" />
            ) : state === 'idle' ? (
              <EmptyState
                title="Meet someone new"
                icon={<UserRound size={32} />}
              >
                Search the sample username to preview the public profile layout.
                Live Roblox lookup is not connected yet.
              </EmptyState>
            ) : state === 'empty' ? (
              <EmptyState title="No sample profile found">
                “{searched}” isn't in the local fixture. Try Roblox to explore
                the profile preview.
              </EmptyState>
            ) : state === 'error' ? (
              <EmptyState
                title="Profile preview interrupted"
                action={
                  <button className="button" onClick={search}>
                    Try again
                  </button>
                }
              >
                This is a simulated error. No request was sent to Roblox.
              </EmptyState>
            ) : (
              <div className="public-profile">
                <FixtureBadge>Sample profile · not live data</FixtureBadge>
                <div className="profile-identity">
                  <div
                    className="profile-avatar"
                    aria-label="Placeholder avatar"
                  >
                    R
                  </div>
                  <div>
                    <h2>Roblox</h2>
                    <p>@Roblox</p>
                    <span className="profile-joined">
                      <CalendarDays size={14} />
                      Sample join date: September 2006
                    </span>
                  </div>
                </div>
                <p>
                  This card previews public account information. Avatar art,
                  biography, and counts will come from a verified public data
                  integration in a later milestone.
                </p>
                <div className="profile-stats">
                  <div>
                    <strong>—</strong>
                    <span>Friends</span>
                  </div>
                  <div>
                    <strong>—</strong>
                    <span>Followers</span>
                  </div>
                  <div>
                    <strong>—</strong>
                    <span>Following</span>
                  </div>
                </div>
                <a
                  className="button primary"
                  href="https://www.roblox.com/users/1/profile"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open public Roblox profile
                  <ArrowUpRight size={16} />
                </a>
              </div>
            )}
          </section>
          <details className="preview-tools profile-preview-tools">
            <summary>Preview states</summary>
            <div>
              <button onClick={() => setState('loading')}>Loading</button>
              <button onClick={() => setState('empty')}>Empty</button>
              <button onClick={() => setState('error')}>Error</button>
              <button onClick={() => setState('idle')}>Reset</button>
            </div>
          </details>
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
