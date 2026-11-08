import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Clock3,
  Compass,
  Heart,
  Sparkles,
  Star,
} from 'lucide-react';
import { games } from '../data/games';
import type { Game, Page } from '../lib/types';
import type { LibraryStore } from '../hooks/useLibrary';
import {
  EmptyState,
  FixtureBadge,
  GameCard,
  Loading,
  SectionHeading,
} from '../components/ui';
import { InstallationPanel } from '../components/InstallationPanel';
import type { InstallationState } from '../components/InstallationPanel';

export function Home({
  library,
  installation,
  navigate,
  selectGame,
}: {
  library: LibraryStore;
  installation: InstallationState;
  navigate: (page: Page) => void;
  selectGame: (game: Game) => void;
}) {
  const featured = games[0];
  const recent = library.data.recent
    .map((r) => games.find((g) => g.id === r.gameId))
    .filter((g): g is Game => Boolean(g));
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="greeting">A little exploration goes a long way.</p>
          <h1>
            Welcome to your next adventure<span className="heading-dot">.</span>
          </h1>
        </div>
        <FixtureBadge />
      </div>
      <div className="home-layout">
        <div className="home-main">
          <section className="featured">
            <img
              className="featured-image"
              src="/artwork/featured.webp"
              alt="Blox Fruits artwork from the supplied Nova design reference"
            />
            <div className="featured-scrim" />
            <div className="featured-copy">
              <span className="featured-label">
                <Star size={13} fill="currentColor" />
                In the spotlight
              </span>
              <span className="hero-category">Adventure / Open world</span>
              <h2>Blox Fruits</h2>
              <p>
                New islands. Powerful abilities.
                <br />
                Your next adventure is out there.
              </p>
              <div className="featured-actions">
                <button
                  className="button primary"
                  onClick={() => selectGame(featured)}
                >
                  Explore game
                  <ArrowUpRight size={17} />
                </button>
                <button
                  className={`button hero-favorite ${library.data.favorites.includes(featured.id) ? 'selected' : ''}`}
                  disabled={!library.ready || library.saving}
                  onClick={() => void library.toggleFavorite(featured.id)}
                  aria-label="Favorite Blox Fruits"
                  aria-pressed={library.data.favorites.includes(featured.id)}
                >
                  <Heart
                    size={18}
                    fill={
                      library.data.favorites.includes(featured.id)
                        ? 'currentColor'
                        : 'none'
                    }
                  />
                </button>
              </div>
            </div>
            <span className="featured-caption">
              Featured pick · development fixture
            </span>
          </section>
          <section className="content-section">
            <SectionHeading
              icon={<Compass size={20} />}
              title="Popular right now"
              action={
                <button
                  className="text-button"
                  onClick={() => navigate('discover')}
                >
                  Discover all
                  <ArrowRight size={15} />
                </button>
              }
            />
            <p className="section-description">
              A few community favorites to get you started. Sample rankings.
            </p>
            <div className="game-grid home-game-grid">
              {games.slice(0, 5).map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  library={library}
                  onSelect={selectGame}
                />
              ))}
            </div>
          </section>
          <section className="content-section recent-section">
            <SectionHeading
              icon={<Clock3 size={20} />}
              title="Recently launched"
              action={<span className="quiet-label">On this device</span>}
            />
            {library.loading ? (
              <Loading />
            ) : recent.length ? (
              <div className="game-grid">
                {recent.map((g) => (
                  <GameCard
                    key={g.id}
                    game={g}
                    library={library}
                    onSelect={selectGame}
                  />
                ))}
              </div>
            ) : (
              <div className="recent-empty">
                <div className="empty-icon small">
                  <Clock3 size={23} />
                </div>
                <div>
                  <h3>A fresh start</h3>
                  <p>
                    Your launched games will appear here once launching is
                    supported.
                  </p>
                </div>
                <span className="tag">Coming later</span>
              </div>
            )}
          </section>
        </div>
        <aside className="home-rail">
          <section className="panel welcome-panel">
            <span className="mini-nova">
              <img src="/nova.svg" alt="" />
            </span>
            <h3>
              Your games.
              <br />
              Your space.
            </h3>
            <p>
              Keep your favorites close.
              <br />
              Find something unexpected.
            </p>
            <button className="text-button" onClick={() => navigate('library')}>
              Make it yours
              <ArrowRight size={15} />
            </button>
          </section>
          <InstallationPanel state={installation} />
          <section className="panel quick-panel">
            <h3>Jump back in</h3>
            <button onClick={() => navigate('library')}>
              <Heart size={17} />
              <span>My favorites</span>
              <span className="quick-count">
                {library.data.favorites.length}
              </span>
              <ArrowRight size={14} />
            </button>
            <button onClick={() => navigate('discover')}>
              <Sparkles size={17} />
              <span>Find an experience</span>
              <ArrowRight size={14} />
            </button>
            <button onClick={() => navigate('settings')}>
              <BookOpen size={17} />
              <span>Launcher setup</span>
              <ArrowRight size={14} />
            </button>
          </section>
          <div className="fixture-note">
            <span className="status-dot violet" />
            <p>
              You're exploring a development catalog. Game data isn't live yet.
            </p>
          </div>
        </aside>
      </div>
      {!library.loading && !library.ready && (
        <EmptyState
          title="Your library is unavailable"
          action={
            <button className="button" onClick={() => void library.reload()}>
              Try again
            </button>
          }
        >
          Check the storage error above before saving favorites.
        </EmptyState>
      )}
    </>
  );
}
