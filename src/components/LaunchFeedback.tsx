import { useI18n } from '../i18n';
import { LocalizedError } from './LocalizedError';
import { useLauncher } from '../hooks/useLauncher';
import type { LaunchRequest } from '../lib/types';

export function LaunchFeedback({
  action,
}: {
  action: LaunchRequest['action'];
}) {
  const { t } = useI18n();
  const launcher = useLauncher();
  if (launcher.lastAction !== action) return null;
  if (launcher.launchError)
    return (
      <div className="notice launch-error" role="alert">
        <LocalizedError
          error={launcher.launchFailure ?? launcher.launchError}
          context="launch"
        />
      </div>
    );
  if (!launcher.receipt) return null;
  return (
    <div className="notice launch-feedback" role="status">
      <div>
        {action === 'launchClient'
          ? t(
              'Client launch request accepted. Check the client window; Nova cannot confirm that it finished starting.',
            )
          : t(
              'Experience page request accepted by your browser. Use Play on Roblox to join; Nova has not confirmed game entry.',
            )}
        {launcher.receipt.warning && (
          <div className="history-warning">
            <LocalizedError
              error={launcher.receipt.warning}
              context="warning"
            />
          </div>
        )}
      </div>
    </div>
  );
}
