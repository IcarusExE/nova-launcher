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
import { useCatalog } from '../hooks/useCatalog';
import type { Game, Page } from '../lib/types';
import type { LibraryStore } from '../hooks/useLibrary';
import {
  EmptyState,
  DataBadge,
  CatalogFeedback,
  RobloxImage,
  GameCard,
  SectionHeading,
} from '../components/ui';
import { RequestHistory } from '../components/RequestHistory';
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
  const catalog = useCatalog();
  const games = catalog.startingPlaceIds
    .map((id) => catalog.experiences.find((g) => g.id === id))
    .filter((g): g is Game => Boolean(g));
  const featured = games[0];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="greeting">A little exploration goes a long way.</p>
          <h1>
            Welcome to your next adventure<span className="heading-dot">.</span>
          </h1>
        </div>
        <DataBadge />
      </div>
      <div className="home-layout">
        <div className="home-main">
          {featured ? (
            <section className="featured">
              <RobloxImage
                className="featured-image"
                src={featured.thumbnailUrl ?? featured.iconUrl}
              />
              <div className="featured-scrim" />
              <div className="featured-copy">
                <span className="featured-label">
                  <Star size={13} fill="currentColor" />
                  In the spotlight
                </span>
                <span className="hero-category">
                  {featured.category ?? 'Roblox experience'}
                </span>
                <h2>{featured.name}</h2>
                <p className="featured-description">
                  {featured.description || 'No public description available.'}
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
                    aria-label={`Favorite ${featured.name}`}
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
                {featured.cached
                  ? 'Saved Roblox snapshot'
                  : 'Curated pick · Roblox metadata'}
              </span>
            </section>
          ) : (
            <section className="panel">
              <EmptyState title="Explore Roblox">
                Verified experience data appears here when available. Your
                client and library remain accessible.
              </EmptyState>
            </section>
          )}
          <CatalogFeedback />
          <section className="content-section">
            <SectionHeading
              icon={<Compass size={20} />}
              title="Starting points"
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
              Curated starting IDs with Roblox metadata. This is not a
              popularity ranking.
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
              title="Recent requests"
              action={<span className="quiet-label">On this device</span>}
            />
            <RequestHistory limit={4} selectGame={selectGame} />
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
              Public API preview. Availability depends on Roblox; metadata
              contracts can change.
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
