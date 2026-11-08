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
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Game } from '../lib/types';
import type { LibraryStore } from '../hooks/useLibrary';

export function FixtureBadge({
  children = 'Development fixtures',
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
          <img src={`/artwork/${game.image}.webp`} alt="" loading="lazy" />
        </div>
        <div className="game-copy">
          <h3>{game.name}</h3>
          <p>{game.category}</p>
          <div className="game-metrics">
            <span>
              <ThumbsUp size={12} />
              {game.fixtureRating}%
            </span>
            <span>
              <Users size={12} />
              {formatCount(game.fixturePlayers)}
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
export const formatCount = (count: number) => `${(count / 1000).toFixed(1)}K`;
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
  return (
    <div className="game-details">
      <div className="detail-art">
        <img src={`/artwork/${game.image}.webp`} alt="" />
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
        <FixtureBadge>Sample game details</FixtureBadge>
        <h2>{game.name}</h2>
        <p className="muted">By {game.creator}</p>
        <p>{game.description}</p>
        <div className="detail-stats">
          <span>
            <ThumbsUp size={17} />
            <b>{game.fixtureRating}%</b> sample rating
          </span>
          <span>
            <Users size={17} />
            <b>{formatCount(game.fixturePlayers)}</b> sample players
          </span>
        </div>
        <span className="tag">{game.category}</span>
        <div className="detail-actions">
          <a
            className="button primary"
            href={`https://www.roblox.com/games/${game.id}`}
            target="_blank"
            rel="noreferrer"
          >
            View on Roblox
            <ArrowUpRight size={16} />
          </a>
          <button
            className={`button ${favorite ? 'selected' : ''}`}
            disabled={!library.ready || library.saving}
            onClick={() => void library.toggleFavorite(game.id)}
            aria-label={`${favorite ? 'Remove' : 'Add'} favorite`}
          >
            <Heart size={18} fill={favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="notice">
          <Gamepad2 size={18} />
          <span>
            In-app launching is coming in a later milestone. The link opens the
            Roblox website.
          </span>
        </div>
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
