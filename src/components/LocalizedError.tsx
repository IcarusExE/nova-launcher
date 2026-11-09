import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n';
import { errorMessage } from '../lib/launcher';
const apiKeys = {
  invalidInput: 'api.invalidInput',
  offline: 'api.offline',
  timeout: 'api.timeout',
  rateLimited: 'api.rateLimited',
  forbidden: 'api.forbidden',
  notFound: 'api.notFound',
  invalidResponse: 'api.invalidResponse',
  unavailable: 'api.unavailable',
  cache: 'api.cache',
  busy: 'api.busy',
  desktopRequired: 'api.desktopRequired',
} as const;
const launchKeys = {
  invalidPlaceId: 'launch.invalidPlaceId',
  unsupportedPlatform: 'launch.unsupportedPlatform',
  flatpakMissing: 'launch.flatpakMissing',
  clientMissing: 'launch.clientMissing',
  detectionFailed: 'launch.detectionFailed',
  unsupportedInstallation: 'launch.unsupportedInstallation',
  dispatchFailed: 'launch.dispatchFailed',
  busy: 'launch.busy',
} as const;
const fallbacks = {
  api: 'api.unavailable',
  launch:
    'The native request failed. Check the client or browser before retrying.',
  storageRead:
    'Could not read the local library. Existing data has not been overwritten.',
  storageSave: 'Could not save changes. Check local storage and retry.',
  history: 'Could not read saved requests. Retry to check local storage.',
  detection: 'Could not check installations. Rescan to try again.',
  window:
    'The window action failed. Use your desktop window manager to control the window.',
  warning:
    'The request was accepted, but history could not be saved. Check storage.',
} as const;
export function errorKey(
  error: unknown,
  context: keyof typeof fallbacks,
): MessageKey {
  if (
    context === 'window' &&
    error === 'Could not open the Roblox website in your browser.'
  )
    return 'Could not open the Roblox website in your browser.';
  const code =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : '';
  const keys: Readonly<Record<string, MessageKey>> =
    context === 'api' ? apiKeys : context === 'launch' ? launchKeys : {};
  return Object.hasOwn(keys, code) ? keys[code] : fallbacks[context];
}
export function Diagnostics({
  detail,
  code,
}: {
  detail: string;
  code?: string;
}) {
  const { t } = useI18n();
  return (
    <details className="diagnostics">
      <summary>{t('Technical details')}</summary>
      {code && <code>{code}</code>}
      <pre dir="auto">{detail}</pre>
    </details>
  );
}
export function LocalizedError({
  error,
  context = 'api',
}: {
  error: unknown;
  context?: keyof typeof fallbacks;
}) {
  const { t } = useI18n();
  const seconds =
    error &&
    typeof error === 'object' &&
    'retryAfterSeconds' in error &&
    typeof error.retryAfterSeconds === 'number'
      ? error.retryAfterSeconds
      : 1;
  const message = t(errorKey(error, context), { count: Math.max(1, seconds) });
  const detail = errorMessage(error, '');
  const code =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : undefined;
  return (
    <div className="localized-error">
      <span>{message}</span>
      {(code || (detail && detail !== message)) && (
        <Diagnostics detail={detail} code={code} />
      )}
    </div>
  );
}
