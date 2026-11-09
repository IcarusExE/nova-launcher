import { useI18n } from '../i18n';
import { ExternalLink, Monitor } from 'lucide-react';
import { useLauncher } from '../hooks/useLauncher';
import { useCatalog } from '../hooks/useCatalog';
import type { Game } from '../lib/types';
import { LocalizedError } from './LocalizedError';
import { Loading } from './ui';

export function RequestHistory({
  limit = 100,
  selectGame,
}: {
  limit?: number;
  selectGame: (game: Game) => void;
}) {
  const { t, date, relative } = useI18n();
  const { experiences: games } = useCatalog();
  const { history, historyLoading, historyError, refreshHistory } =
    useLauncher();
  if (historyLoading) return <Loading label={t('Loading request history…')} />;
  if (historyError)
    return (
      <div className="inline-error" role="alert">
        <LocalizedError error={historyError} context="history" />
        <button className="text-button" onClick={() => void refreshHistory()}>
          {t('Retry history')}
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
          <h3>{t('No launch requests yet')}</h3>
          <p>
            {t(
              'Accepted client and browser requests appear here. They do not confirm game entry or playtime.',
            )}
          </p>
        </div>
      </div>
    );
  return (
    <div className="request-history">
      <p className="section-description">
        {t(
          'Accepted by the operating system · does not confirm game entry or playtime.',
        )}
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
                  ? t('{client} · client request', {
                      client:
                        request.adapter === 'sober' ? 'Sober' : 'Roblox Player',
                    })
                  : t('Experience page · Place {id}', {
                      id: request.placeId ?? '—',
                    })}
              </strong>
              <span>
                {request.action === 'launchClient'
                  ? t('Standalone launch requested')
                  : t('Browser dispatch requested')}
              </span>
              {game && (
                <button
                  className="text-button"
                  onClick={() => selectGame(game)}
                >
                  {t('{name} · details', { name: game.name })}
                </button>
              )}
            </div>
            <time
              dateTime={new Date(request.acceptedAt).toISOString()}
              title={date(request.acceptedAt, true)}
            >
              {relative(request.acceptedAt)}
            </time>
          </div>
        );
      })}
    </div>
  );
}
