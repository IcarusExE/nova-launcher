import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('Nova milestone flows', () => {
  it('saves a favorite and restores it after remounting', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    const favorite = await screen.findByRole('button', {
      name: 'Add Brookhaven RP to favorites',
    });
    await waitFor(() => expect(favorite).toBeEnabled());
    await user.click(favorite);
    await user.click(screen.getByRole('button', { name: /^Library/ }));
    expect(
      await screen.findByRole('button', { name: 'View Brookhaven RP' }),
    ).toBeVisible();
    unmount();
    render(<App />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: 'Remove Brookhaven RP from favorites',
        }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: /^Library/ }));
    await user.click(screen.getByRole('button', { name: 'List view' }));
    expect(
      screen
        .getByRole('button', { name: 'View Brookhaven RP' })
        .closest('article'),
    ).toHaveClass('game-card-list');
    await user.click(
      screen.getByRole('button', {
        name: 'Remove Brookhaven RP from favorites',
      }),
    );
    expect(await screen.findByText('Good things belong here.')).toBeVisible();
  });
  it('filters the catalog, clears empty results, and recovers from its explicit error preview', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Discover' }));
    await screen.findByRole('button', { name: 'View Blox Fruits' });
    await user.type(
      screen.getByRole('textbox', { name: 'Search games' }),
      'no such world',
    );
    expect(screen.getByText('No games found')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await user.click(screen.getByRole('button', { name: 'Roleplay' }));
    expect(
      screen.getByRole('button', { name: 'View Brookhaven RP' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'View Blade Ball' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByText('Preview states'));
    await user.click(screen.getByRole('button', { name: 'Error' }));
    expect(screen.getByText('Catalog preview interrupted')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      screen.getByRole('button', { name: 'View Brookhaven RP' }),
    ).toBeVisible();
  });
  it('keeps corrupt libraries unchanged and disables saving', async () => {
    localStorage.setItem('nova-library-v1', '{broken');
    render(<App />);
    expect(await screen.findByRole('alert')).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Add Brookhaven RP to favorites' }),
      ).toBeDisabled(),
    );
    expect(localStorage.getItem('nova-library-v1')).toBe('{broken');
  });
  it('does not show a failed save as a favorite', async () => {
    const user = userEvent.setup();
    render(<App />);
    const button = screen.getByRole('button', {
      name: 'Add Brookhaven RP to favorites',
    });
    await waitFor(() => expect(button).toBeEnabled());
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('Storage is full');
      });
    await user.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Storage is full',
    );
    expect(button).toHaveAttribute('aria-pressed', 'false');
    spy.mockRestore();
  });
  it('persists appearance preferences and the selected start page', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const compact = screen.getByRole('switch', { name: 'Compact game cards' });
    await waitFor(() => expect(compact).toBeEnabled());
    await user.click(compact);
    expect(compact).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('tab', { name: 'Launcher' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Start page' }),
      'library',
    );
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem('nova-library-v1')!).preferences
          .startPage,
      ).toBe('library'),
    );
    unmount();
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'Your library' }),
    ).toBeVisible();
  });
  it('searches only the labeled profile fixture and links to the public website', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Profile' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Roblox username' }),
      'Roblox',
    );
    await user.click(screen.getByRole('button', { name: 'Search profile' }));
    expect(
      await screen.findByText('Sample profile · not live data'),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Open public Roblox profile' }),
    ).toHaveAttribute('href', 'https://www.roblox.com/users/1/profile');
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });
  it('opens a game dialog with an honest website fallback', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Explore game' }));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByRole('link', { name: 'View on Roblox' }),
    ).toHaveAttribute('href', 'https://www.roblox.com/games/2753915549');
    expect(
      within(dialog).getByText(
        /Join experience through the official Roblox page/,
      ),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Open experience page' }),
    ).toBeDisabled();
    await user.click(
      within(dialog).getByRole('button', { name: 'Close game details' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
