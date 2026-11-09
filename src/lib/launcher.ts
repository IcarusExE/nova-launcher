import { invoke, isTauri } from '@tauri-apps/api/core';
import type { AcceptedRequest, LaunchReceipt, LaunchRequest } from './types';

export const desktopAvailable = () => isTauri();
export function errorMessage(
  error: unknown,
  fallback = 'The request could not be dispatched. Check the client or browser before retrying.',
): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  )
    return error.message;
  return fallback;
}
export async function dispatchRequest(
  request: LaunchRequest,
): Promise<LaunchReceipt> {
  if (!isTauri())
    throw new Error('Launch requests require the Nova desktop app.');
  return invoke('launch_request', { request });
}
export async function readLaunchHistory(): Promise<AcceptedRequest[]> {
  return isTauri() ? invoke('load_launch_history') : [];
}
