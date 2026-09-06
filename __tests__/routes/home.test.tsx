import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import RootLayout from '../../app/_layout';
import HomeScreen from '../../app/index';
import RoomRouteScreen from '../../app/room/[code]';

const mockBootstrap = jest.fn();
const mockUnsubscribe = jest.fn();
const mockStartRefresh = jest.fn();
const mockStopRefresh = jest.fn();
jest.mock('../../src/auth/anonymous-session', () => ({ bootstrapAnonymousSession: () => mockBootstrap() }));
jest.mock('../../src/lib/supabase', () => ({ getSupabase: () => ({ auth: {
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: mockUnsubscribe } } }),
  startAutoRefresh: mockStartRefresh, stopAutoRefresh: mockStopRefresh,
} }) }));
beforeEach(() => { jest.clearAllMocks(); mockBootstrap.mockReset().mockResolvedValue({ user: { id: 'synthetic' } }); });

const routes = { _layout: RootLayout, index: HomeScreen, 'room/[code]': RoomRouteScreen };

async function mount(initialUrl: string) {
  const view = renderRouter(routes, { initialUrl });
  await act(async () => {});
  return view;
}

describe('inert application navigation', () => {
  it('navigates from home to the dynamic route and back without a backend', async () => {
    const navigation = await mount('/');
    expect(navigation.getPathname()).toBe('/');
    await fireEvent.press(await screen.findByRole('link', { name: 'Open route preview' }));
    expect(navigation.getPathname()).toBe('/room/0A1B2C3D4E');
    await fireEvent.press(await screen.findByRole('link', { name: 'Back to home' }));
    expect(navigation.getPathname()).toBe('/');
    expect(screen.getByRole('link', { name: 'Open route preview' })).toBeVisible();
  });

  it('resolves a direct dynamic route and permits returning home', async () => {
    const navigation = await mount('/room/ABCDEF0123');
    expect(navigation.getPathname()).toBe('/room/ABCDEF0123');
    expect(navigation.getSegments()).toEqual(['room', '[code]']);
    await fireEvent.press(await screen.findByRole('link', { name: 'Back to home' }));
    expect(navigation.getPathname()).toBe('/');
    await screen.findByRole('link', { name: 'Open route preview' });
  });
});

describe('mounted Auth boundary', () => {
  it('does not mount a protected route or permit navigation while bootstrap is pending', async () => {
    let resolve!: (value: unknown) => void;
    mockBootstrap.mockReturnValue(new Promise(done => { resolve = done; }));
    const view = await mount('/');
    expect(screen.getByText('Restoring local session…')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Open route preview' })).toBeNull();
    expect(view.getPathname()).toBe('/');
    await act(async () => { resolve({ user: { id: 'synthetic' } }); });
    await screen.findByRole('link', { name: 'Open route preview' });
    expect(mockBootstrap).toHaveBeenCalledTimes(1);
  });

  it('shows only a generic retry after failure and keeps the actual route gated until retry succeeds', async () => {
    mockBootstrap.mockRejectedValueOnce(new Error('sensitive backend details'));
    await mount('/room/ABCDEF0123');
    const retry = await screen.findByRole('button', { name: 'Retry session' });
    expect(screen.getByText('Unable to restore your local session. Please try again.')).toBeVisible();
    expect(screen.queryByText('sensitive backend details')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Back to home' })).toBeNull();
    expect(mockBootstrap).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.press(retry); });
    await screen.findByRole('link', { name: 'Back to home' });
    expect(mockBootstrap).toHaveBeenCalledTimes(2);
  });

  it('cleans up native refresh and Auth listeners on unmount', async () => {
    const view = await mount('/');
    await screen.findByRole('link', { name: 'Open route preview' });
    view.unmount();
    await waitFor(() => expect(mockUnsubscribe).toHaveBeenCalled());
    expect(mockStopRefresh).toHaveBeenCalled();
  });
});
