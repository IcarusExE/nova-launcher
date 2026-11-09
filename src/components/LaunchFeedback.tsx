import { useLauncher } from '../hooks/useLauncher';
import type { LaunchRequest } from '../lib/types';

export function LaunchFeedback({
  action,
}: {
  action: LaunchRequest['action'];
}) {
  const launcher = useLauncher();
  if (launcher.lastAction !== action) return null;
  if (launcher.launchError)
    return (
      <p className="notice launch-error" role="alert">
        {launcher.launchError}
      </p>
    );
  if (!launcher.receipt) return null;
  return (
    <div className="notice launch-feedback" role="status">
      <span>
        {action === 'launchClient'
          ? 'Client launch request accepted. Check the client window; Nova cannot confirm that it finished starting.'
          : 'Experience page request accepted by your browser. Use Play on Roblox to join; Nova has not confirmed game entry.'}
        {launcher.receipt.warning && (
          <strong className="history-warning">
            {launcher.receipt.warning}
          </strong>
        )}
      </span>
    </div>
  );
}
