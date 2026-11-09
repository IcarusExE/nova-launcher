import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { defaultLibrary } from './lib/storage';
import type {
  AcceptedRequest,
  AdapterStatus,
  LaunchReceipt,
} from './lib/types';

const ipc = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: ipc.invoke,
}));

let history: AcceptedRequest[];
let status: AdapterStatus;
let rejectDispatch = false;
let receiptWarning: string | null = null;
beforeEach(() => {
  history = [];
  rejectDispatch = false;
  receiptWarning = null;
  status = {
    id: 'sober',
    name: 'Sober',
    platform: 'Linux · Flatpak',
    installation: 'detected',
    location: '/var/lib/flatpak/sober',
    detail: 'Installed Sober',
    capabilities: { detect: true, launch: true, directJoin: false },
    runtimeVerified: true,
  };
  ipc.invoke.mockReset();
  ipc.invoke.mockImplementation(
    async (
      command: string,
      args?: {
        request: {
          action: 'launchClient' | 'openExperience';
          placeId?: string;
        };
      },
    ) => {
      if (command === 'load_library') return structuredClone(defaultLibrary);
      if (command === 'detect_installations') return [status];
      if (command === 'load_launch_history') return [...history];
      if (command === 'launch_request') {
        if (rejectDispatch)
          throw {
            code: 'dispatchFailed',
            message: 'Flatpak rejected the request. Check Sober and retry.',
          };
        const request: AcceptedRequest = {
          action: args!.request.action,
          adapter: args!.request.action === 'launchClient' ? 'sober' : null,
          placeId: args!.request.placeId ?? null,
          acceptedAt: Date.now(),
        };
        if (!receiptWarning) history.unshift(request);
        return {
          request,
          historySaved: !receiptWarning,
          warning: receiptWarning,
        } satisfies LaunchReceipt;
      }
      if (command === 'reveal_main_window') return;
      if (command === 'save_library') return;
      throw new Error(`Unexpected IPC ${command}`);
    },
  );
});

describe('native launch UI with simulated IPC, not real client execution', () => {
  it('dispatches a standalone client request and shows accepted request history', async () => {
    const user = userEvent.setup();
    render(<App />);
    const button = screen.getByRole('button', { name: 'Launch Roblox' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(ipc.invoke).toHaveBeenCalledWith('launch_request', {
      request: { action: 'launchClient', adapter: 'auto' },
    });
    expect(
      await screen.findByText(/Client launch request accepted/),
    ).toBeVisible();
    expect(await screen.findByText('Sober · client request')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Library' }));
    await user.click(screen.getByRole('button', { name: /Recent requests/ }));
    expect(
      screen.getByText(/does not confirm game entry or playtime/),
    ).toBeVisible();
  });
  it('opens a validated experience action without passing a URL or claiming a join', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Explore game' }));
    const dialog = screen.getByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Open experience page' }),
    );
    expect(ipc.invoke).toHaveBeenCalledWith('launch_request', {
      request: { action: 'openExperience', placeId: '2753915549' },
    });
    expect(
      await within(dialog).findByText(/Nova has not confirmed game entry/),
    ).toBeVisible();
  });
  it('keeps missing installations disabled while leaving the browser fallback available', async () => {
    status.installation = 'notFound';
    status.capabilities.launch = false;
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Not installed');
    expect(
      screen.getByRole('button', { name: 'Launch Roblox' }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Explore game' }));
    expect(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Open experience page',
      }),
    ).toBeEnabled();
    expect(ipc.invoke.mock.calls.some(([c]) => c === 'launch_request')).toBe(
      false,
    );
  });
  it('shows structured dispatch errors without fabricating history', async () => {
    rejectDispatch = true;
    const user = userEvent.setup();
    render(<App />);
    const button = screen.getByRole('button', { name: 'Launch Roblox' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Flatpak rejected the request',
    );
    expect(screen.getByText('No launch requests yet')).toBeVisible();
    expect(
      screen.queryByText(/Client launch request accepted/),
    ).not.toBeInTheDocument();
  });
  it('keeps accepted dispatch successful when SQLite history could not be saved', async () => {
    receiptWarning =
      'The request was accepted, but history could not be saved. Check storage.';
    const user = userEvent.setup();
    render(<App />);
    const button = screen.getByRole('button', { name: 'Launch Roblox' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(await screen.findByText(receiptWarning)).toBeVisible();
    expect(screen.getByText(/Client launch request accepted/)).toBeVisible();
    expect(history).toEqual([]);
  });
  it('disables repeated requests while native dispatch is pending', async () => {
    const original = ipc.invoke.getMockImplementation()!;
    let finish!: (receipt: LaunchReceipt) => void;
    ipc.invoke.mockImplementation((command: string, ...args: unknown[]) =>
      command === 'launch_request'
        ? new Promise<LaunchReceipt>((resolve) => {
            finish = resolve;
          })
        : original(command, ...args),
    );
    const user = userEvent.setup();
    render(<App />);
    const button = screen.getByRole('button', { name: 'Launch Roblox' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(
      screen.getByRole('button', { name: 'Requesting launch…' }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole('button', { name: 'Requesting launch…' }),
    );
    expect(
      ipc.invoke.mock.calls.filter(([c]) => c === 'launch_request'),
    ).toHaveLength(1);
    finish({
      request: {
        action: 'launchClient',
        adapter: 'sober',
        placeId: null,
        acceptedAt: Date.now(),
      },
      historySaved: true,
      warning: null,
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Launch Roblox' }),
      ).toBeEnabled(),
    );
  });
});
