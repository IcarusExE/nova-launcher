import { useI18n } from '../i18n';
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
  const { t, number } = useI18n();
  const catalog = useCatalog();
  const games = catalog.startingPlaceIds
    .map((id) => catalog.experiences.find((g) => g.id === id))
    .filter((g): g is Game => Boolean(g));
  const featured = games[0];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="greeting">
            {t('A little exploration goes a long way.')}
          </p>
          <h1>
            {t('Welcome to your next adventure')}
            <span className="heading-dot">.</span>
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
                  {t('In the spotlight')}
                </span>
                <span className="hero-category">
                  {featured.category ?? t('Roblox experience')}
                </span>
                <h2>{featured.name}</h2>
                <p className="featured-description">
                  {featured.description ||
                    t('No public description available.')}
                </p>
                <div className="featured-actions">
                  <button
                    className="button primary"
                    onClick={() => selectGame(featured)}
                  >
                    {t('Explore game')}
                    <ArrowUpRight size={17} />
                  </button>
                  <button
                    className={`button hero-favorite ${library.data.favorites.includes(featured.id) ? 'selected' : ''}`}
                    disabled={!library.ready || library.saving}
                    onClick={() => void library.toggleFavorite(featured.id)}
                    aria-label={t('Favorite {name}', { name: featured.name })}
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
                  ? t('Saved Roblox snapshot')
                  : t('Curated pick · Roblox metadata')}
              </span>
            </section>
          ) : (
            <section className="panel">
              <EmptyState title={t('Explore Roblox')}>
                {t(
                  'Verified experience data appears here when available. Your client and library remain accessible.',
                )}
              </EmptyState>
            </section>
          )}
          <CatalogFeedback />
          <section className="content-section">
            <SectionHeading
              icon={<Compass size={20} />}
              title={t('Starting points')}
              action={
                <button
                  className="text-button"
                  onClick={() => navigate('discover')}
                >
                  {t('Discover all')}
                  <ArrowRight size={15} />
                </button>
              }
            />
            <p className="section-description">
              {t(
                'Curated starting IDs with Roblox metadata. This is not a popularity ranking.',
              )}
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
              title={t('Recent requests')}
              action={
                <span className="quiet-label">{t('On this device')}</span>
              }
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
              {t('Your games.')}
              <br />
              {t('Your space.')}
            </h3>
            <p>
              {t('Keep your favorites close.')}
              <br />
              {t('Find something unexpected.')}
            </p>
            <button className="text-button" onClick={() => navigate('library')}>
              {t('Make it yours')}
              <ArrowRight size={15} />
            </button>
          </section>
          <InstallationPanel state={installation} />
          <section className="panel quick-panel">
            <h3>{t('Jump back in')}</h3>
            <button onClick={() => navigate('library')}>
              <Heart size={17} />
              <span>{t('My favorites')}</span>
              <span className="quick-count">
                {number(library.data.favorites.length)}
              </span>
              <ArrowRight size={14} />
            </button>
            <button onClick={() => navigate('discover')}>
              <Sparkles size={17} />
              <span>{t('Find an experience')}</span>
              <ArrowRight size={14} />
            </button>
            <button onClick={() => navigate('settings')}>
              <BookOpen size={17} />
              <span>{t('Launcher setup')}</span>
              <ArrowRight size={14} />
            </button>
          </section>
          <div className="fixture-note">
            <span className="status-dot violet" />
            <p>
              {t(
                'Public API preview. Availability depends on Roblox; metadata contracts can change.',
              )}
            </p>
          </div>
        </aside>
      </div>
      {!library.loading && !library.ready && (
        <EmptyState
          title={t('Your library is unavailable')}
          action={
            <button className="button" onClick={() => void library.reload()}>
              {t('Try again')}
            </button>
          }
        >
          {t('Check the storage error above before saving favorites.')}
        </EmptyState>
      )}
    </>
  );
}
