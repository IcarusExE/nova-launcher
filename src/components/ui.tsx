import { useI18n } from '../i18n';
import {
  ArrowUpRight,
  Heart,
  SearchX,
  X,
  LoaderCircle,
  ExternalLink,
  Gamepad2,
  ThumbsUp,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { LocalizedError } from './LocalizedError';
import { rating } from '../lib/roblox';
import { useCatalog } from '../hooks/useCatalog';
import type { Game } from '../lib/types';
import { useLauncher } from '../hooks/useLauncher';
import { LaunchFeedback } from './LaunchFeedback';
import type { LibraryStore } from '../hooks/useLibrary';

export function DataBadge({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  const defaultText = t('Public Roblox API preview');
  return (
    <span className="fixture-badge">
      <span />
      {children ?? defaultText}
    </span>
  );
}
export function EmptyState({
  title,
  children,
  action,
  icon,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon ?? <SearchX size={30} />}</div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Loading({ label }: { label?: string }) {
  const { t } = useI18n();
  const defaultText = t('Loading your library…');
  return (
    <div className="loading-state" role="status">
      <LoaderCircle size={23} className="spin" />
      {label ?? defaultText}
    </div>
  );
}
export function SectionHeading({
  icon,
  title,
  action,
}: {
  icon?: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <h2>
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}
export function GameCard({
  game,
  library,
  onSelect,
  list = false,
}: {
  game: Game;
  library: LibraryStore;
  onSelect: (game: Game) => void;
  list?: boolean;
}) {
  const { t, number, percent } = useI18n();
  const favorite = library.data.favorites.includes(game.id);
  return (
    <article className={`game-card ${list ? 'game-card-list' : ''}`}>
      <button
        className="game-open"
        onClick={() => onSelect(game)}
        aria-label={t('View {name}', { name: game.name })}
      >
        <div className="game-art">
          <RobloxImage src={game.iconUrl} />
        </div>
        <div className="game-copy">
          <h3>{game.name}</h3>
          <p>{game.category ?? t('Category unavailable')}</p>
          <div className="game-metrics">
            <span>
              <ThumbsUp size={12} />
              {rating(game) === null ? '—' : percent(rating(game)!)}
            </span>
            <span>
              <Users size={12} />
              {game.players === null ? '—' : number(game.players, true)}
            </span>
          </div>
        </div>
      </button>
      <button
        className={`favorite-button ${favorite ? 'is-favorite' : ''}`}
        aria-label={t(
          favorite ? 'Remove {name} from favorites' : 'Add {name} to favorites',
          { name: game.name },
        )}
        aria-pressed={favorite}
        disabled={!library.ready || library.saving}
        onClick={() => void library.toggleFavorite(game.id)}
      >
        <Heart size={17} fill={favorite ? 'currentColor' : 'none'} />
      </button>
    </article>
  );
}
export function GameDetails({
  game,
  library,
  onClose,
}: {
  game: Game;
  library: LibraryStore;
  onClose?: () => void;
}) {
  const { t, number, percent, date } = useI18n();
  const favorite = library.data.favorites.includes(game.id);
  const launcher = useLauncher();
  return (
    <div className="game-details">
      <div className="detail-art">
        <RobloxImage src={game.thumbnailUrl ?? game.iconUrl} />
        {onClose && (
          <button
            className="icon-button detail-close"
            aria-label={t('Close game details')}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        )}
      </div>
      <div className="detail-body">
        <DataBadge>
          {game.cached
            ? t('Saved Roblox snapshot')
            : t('Public Roblox API preview')}
        </DataBadge>
        <h2>{game.name}</h2>
        <p className="muted">{t('By {creator}', { creator: game.creator })}</p>
        <p
          className="experience-description"
          tabIndex={0}
          aria-label={t('Experience description')}
        >
          {game.description || t('No public description.')}
        </p>
        <div className="detail-stats">
          <span>
            <ThumbsUp size={17} />
            <b>{rating(game) === null ? '—' : percent(rating(game)!)}</b>{' '}
            {t('approval')}
          </span>
          <span>
            <Users size={17} />
            <b>
              {game.players === null ? '—' : number(game.players, true)}
            </b>{' '}
            {t('playing (snapshot)')}
          </span>
        </div>
        <p className="quiet-label">
          {t('Observed {date} · Place {place} · Universe {universe}', {
            date: date(game.observedAt, true),
            place: game.id,
            universe: game.universeId,
          })}
        </p>
        <span className="tag">
          {game.category ?? t('Category unavailable')}
        </span>
        <div className="detail-actions">
          <button
            className="button primary"
            disabled={!launcher.desktop || launcher.busy}
            onClick={() => void launcher.openExperience(game.id)}
          >
            {launcher.busy && launcher.lastAction === 'openExperience'
              ? t('Opening page…')
              : t('Open experience page')}
            <ArrowUpRight size={16} />
          </button>
          <button
            className={`button ${favorite ? 'selected' : ''}`}
            disabled={!library.ready || library.saving}
            onClick={() => void library.toggleFavorite(game.id)}
            aria-label={t(favorite ? 'Remove favorite' : 'Add favorite')}
          >
            <Heart size={18} fill={favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        <LaunchFeedback action="openExperience" />
        <div className="notice">
          <Gamepad2 size={18} />
          <span>
            {t(
              'Join experience through the official Roblox page. Browser dispatch does not confirm game entry. Launch Roblox opens the client separately.',
            )}
          </span>
        </div>
        <ExternalText href={`https://www.roblox.com/games/${game.id}`}>
          {t('View on Roblox')}
        </ExternalText>
        {!launcher.desktop && (
          <p className="muted">
            {t(
              'Launch requests require the desktop app. The link opens the Roblox website.',
            )}
          </p>
        )}
      </div>
    </div>
  );
}
export function GameDialog({
  game,
  library,
  onClose,
}: {
  game: Game | null;
  library: LibraryStore;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const open = game !== null;
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);
  if (!game) return null;
  return (
    <dialog
      ref={ref}
      className="game-dialog"
      aria-label={t('{name} details', { name: game.name })}
      onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0],
          last = controls.at(-1);
        if (!first || !last) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <GameDetails game={game} library={library} onClose={onClose} />
    </dialog>
  );
}
export function ExternalText({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a className="text-link" href={href} target="_blank" rel="noreferrer">
      {children}
      <ExternalLink size={14} />
    </a>
  );
}

/** Failed or pending CDN images never fall back to development artwork. */
export function RobloxImage({
  src,
  className,
}: {
  src: string | null;
  className?: string;
}) {
  const { t } = useI18n();
  const [failed, setFailed] = useState<string | null>(null);
  return src && failed !== src ? (
    <img
      className={className}
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      onError={() => setFailed(src)}
    />
  ) : (
    <span
      className={`image-unavailable ${className ?? ''}`}
      aria-label={t('Artwork unavailable')}
    >
      <Gamepad2 size={28} />
      <span>{t('Artwork unavailable')}</span>
    </span>
  );
}
export function CatalogFeedback() {
  const { t } = useI18n();
  const catalog = useCatalog();
  const issues = [
    ...(catalog.error ? [catalog.error] : []),
    ...catalog.warnings,
  ];
  return (
    <div
      className="data-feedback"
      aria-live="polite"
      aria-busy={catalog.loading}
    >
      {issues.map((issue, index) => (
        <div role="status" key={`${issue.code}-${index}`}>
          <strong>
            {issue.code === 'offline'
              ? t('Offline')
              : issue.code === 'desktopRequired'
                ? t('Desktop app required')
                : t('Data unavailable')}
          </strong>{' '}
          <LocalizedError error={issue} />
        </div>
      ))}
      {catalog.experiences.some((g) => g.cached) && (
        <p>
          {t(
            'Saved snapshots may be out of date. Favorites and launch requests remain on this device.',
          )}
        </p>
      )}
      <button
        className="text-button"
        disabled={catalog.loading}
        onClick={() => void catalog.refresh()}
      >
        {catalog.loading && (
          <LoaderCircle size={14} className="spin" aria-hidden="true" />
        )}
        {catalog.loading
          ? t(
              catalog.experiences.length
                ? 'Refreshing Roblox data…'
                : 'Loading Roblox data…',
            )
          : t('Refresh Roblox data')}
      </button>
    </div>
  );
}
