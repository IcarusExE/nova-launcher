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
import { rating } from '../lib/roblox';
import { useCatalog } from '../hooks/useCatalog';
import type { Game } from '../lib/types';
import { useLauncher } from '../hooks/useLauncher';
import { LaunchFeedback } from './LaunchFeedback';
import type { LibraryStore } from '../hooks/useLibrary';

export function DataBadge({
  children = 'Public Roblox API preview',
}: {
  children?: ReactNode;
}) {
  return (
    <span className="fixture-badge">
      <span />
      {children}
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
export function Loading({
  label = 'Loading your library…',
}: {
  label?: string;
}) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle size={23} className="spin" />
      {label}
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
  const favorite = library.data.favorites.includes(game.id);
  return (
    <article className={`game-card ${list ? 'game-card-list' : ''}`}>
      <button
        className="game-open"
        onClick={() => onSelect(game)}
        aria-label={`View ${game.name}`}
      >
        <div className="game-art">
          <RobloxImage src={game.iconUrl} />
        </div>
        <div className="game-copy">
          <h3>{game.name}</h3>
          <p>{game.category ?? 'Category unavailable'}</p>
          <div className="game-metrics">
            <span>
              <ThumbsUp size={12} />
              {rating(game) === null ? '—' : `${rating(game)}%`}
            </span>
            <span>
              <Users size={12} />
              {game.players === null ? '—' : formatCount(game.players)}
            </span>
          </div>
        </div>
      </button>
      <button
        className={`favorite-button ${favorite ? 'is-favorite' : ''}`}
        aria-label={`${favorite ? 'Remove' : 'Add'} ${game.name} ${favorite ? 'from' : 'to'} favorites`}
        aria-pressed={favorite}
        disabled={!library.ready || library.saving}
        onClick={() => void library.toggleFavorite(game.id)}
      >
        <Heart size={17} fill={favorite ? 'currentColor' : 'none'} />
      </button>
    </article>
  );
}
export const formatCount = (count: number) =>
  new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(count);
export function GameDetails({
  game,
  library,
  onClose,
}: {
  game: Game;
  library: LibraryStore;
  onClose?: () => void;
}) {
  const favorite = library.data.favorites.includes(game.id);
  const launcher = useLauncher();
  return (
    <div className="game-details">
      <div className="detail-art">
        <RobloxImage src={game.thumbnailUrl ?? game.iconUrl} />
        {onClose && (
          <button
            className="icon-button detail-close"
            aria-label="Close game details"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        )}
      </div>
      <div className="detail-body">
        <DataBadge>
          {game.cached ? 'Saved Roblox snapshot' : 'Public Roblox API preview'}
        </DataBadge>
        <h2>{game.name}</h2>
        <p className="muted">By {game.creator}</p>
        <p
          className="experience-description"
          tabIndex={0}
          aria-label="Experience description"
        >
          {game.description || 'No public description.'}
        </p>
        <div className="detail-stats">
          <span>
            <ThumbsUp size={17} />
            <b>{rating(game) === null ? '—' : `${rating(game)}%`}</b> approval
          </span>
          <span>
            <Users size={17} />
            <b>
              {game.players === null ? '—' : formatCount(game.players)}
            </b>{' '}
            playing (snapshot)
          </span>
        </div>
        <p className="quiet-label">
          Observed {new Date(game.observedAt).toLocaleString()} · Place{' '}
          {game.id} · Universe {game.universeId}
        </p>
        <span className="tag">{game.category ?? 'Category unavailable'}</span>
        <div className="detail-actions">
          <button
            className="button primary"
            disabled={!launcher.desktop || launcher.busy}
            onClick={() => void launcher.openExperience(game.id)}
          >
            {launcher.busy && launcher.lastAction === 'openExperience'
              ? 'Opening page…'
              : 'Open experience page'}
            <ArrowUpRight size={16} />
          </button>
          <button
            className={`button ${favorite ? 'selected' : ''}`}
            disabled={!library.ready || library.saving}
            onClick={() => void library.toggleFavorite(game.id)}
            aria-label={`${favorite ? 'Remove' : 'Add'} favorite`}
          >
            <Heart size={18} fill={favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        <LaunchFeedback action="openExperience" />
        <div className="notice">
          <Gamepad2 size={18} />
          <span>
            Join experience through the official Roblox page. Browser dispatch
            does not confirm game entry. Launch Roblox opens the client
            separately.
          </span>
        </div>
        <ExternalText href={`https://www.roblox.com/games/${game.id}`}>
          View on Roblox
        </ExternalText>
        {!launcher.desktop && (
          <p className="muted">
            Launch requests require the desktop app. The link opens the Roblox
            website.
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
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (game && ref.current && !ref.current.open) ref.current.showModal();
  }, [game]);
  if (!game) return null;
  return (
    <dialog
      ref={ref}
      className="game-dialog"
      aria-label={`${game.name} details`}
      onCancel={onClose}
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
      aria-label="Artwork unavailable"
    >
      <Gamepad2 size={28} />
      <span>Artwork unavailable</span>
    </span>
  );
}
export function CatalogFeedback() {
  const catalog = useCatalog();
  const issues = [
    ...(catalog.error ? [catalog.error] : []),
    ...catalog.warnings,
  ];
  return (
    <div className="data-feedback" aria-live="polite">
      {catalog.loading && (
        <Loading
          label={
            catalog.experiences.length
              ? 'Refreshing Roblox data…'
              : 'Loading Roblox data…'
          }
        />
      )}
      {issues.map((issue, index) => (
        <p role="status" key={`${issue.code}-${index}`}>
          <strong>
            {issue.code === 'offline'
              ? 'Offline'
              : issue.code === 'desktopRequired'
                ? 'Desktop app required'
                : 'Data unavailable'}
          </strong>{' '}
          · {issue.message}
        </p>
      ))}
      {catalog.experiences.some((g) => g.cached) && (
        <p>
          Saved snapshots may be out of date. Favorites and launch requests
          remain on this device.
        </p>
      )}
      <button
        className="text-button"
        disabled={catalog.loading}
        onClick={() => void catalog.refresh()}
      >
        Refresh Roblox data
      </button>
    </div>
  );
}
