import { ExternalLink, Monitor } from 'lucide-react';
import { useLauncher } from '../hooks/useLauncher';
import { games } from '../data/games';
import type { Game } from '../lib/types';
import { Loading } from './ui';

export function RequestHistory({
  limit = 100,
  selectGame,
}: {
  limit?: number;
  selectGame: (game: Game) => void;
}) {
  const { history, historyLoading, historyError, refreshHistory } =
    useLauncher();
  if (historyLoading) return <Loading label="Loading request history…" />;
  if (historyError)
    return (
      <div className="inline-error" role="alert">
        {historyError}
        <button className="text-button" onClick={() => void refreshHistory()}>
          Retry history
        </button>
      </div>
    );
  if (!history.length)
    return (
      <div className="recent-empty">
        <div className="empty-icon small">
          <Monitor size={23} />
        </div>
        <div>
          <h3>No launch requests yet</h3>
          <p>
            Accepted client and browser requests appear here. They do not
            confirm game entry or playtime.
          </p>
        </div>
      </div>
    );
  return (
    <div className="request-history">
      <p className="section-description">
        Accepted by the operating system · does not confirm game entry or
        playtime.
      </p>
      {history.slice(0, limit).map((request, index) => {
        const game = games.find((g) => g.id === request.placeId);
        return (
          <div className="request-row" key={`${request.acceptedAt}-${index}`}>
            {request.action === 'launchClient' ? (
              <Monitor size={19} />
            ) : (
              <ExternalLink size={19} />
            )}
            <div>
              <strong>
                {request.action === 'launchClient'
                  ? `${request.adapter === 'sober' ? 'Sober' : 'Roblox Player'} · client request`
                  : `Experience page · Place ${request.placeId}`}
              </strong>
              <span>
                {request.action === 'launchClient'
                  ? 'Standalone launch requested'
                  : 'Browser dispatch requested'}
              </span>
              {game && (
                <button
                  className="text-button"
                  onClick={() => selectGame(game)}
                >
                  {game.name} · fixture details
                </button>
              )}
            </div>
            <time dateTime={new Date(request.acceptedAt).toISOString()}>
              {new Date(request.acceptedAt).toLocaleString()}
            </time>
          </div>
        );
      })}
    </div>
  );
}
