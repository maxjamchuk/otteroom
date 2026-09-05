import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import RootLayout from '../../app/_layout';
import HomeScreen from '../../app/index';
import RoomRouteScreen from '../../app/room/[code]';

const routes = { _layout: RootLayout, index: HomeScreen, 'room/[code]': RoomRouteScreen };

describe('inert application navigation', () => {
  it('navigates from home to the dynamic route and back without a backend', async () => {
    const navigation = renderRouter(routes, { initialUrl: '/' });
    expect(navigation.getPathname()).toBe('/');
    await fireEvent.press(screen.getByRole('link', { name: 'Open route preview' }));
    expect(navigation.getPathname()).toBe('/room/0A1B2C3D4E');
    await fireEvent.press(screen.getByRole('link', { name: 'Back to home' }));
    expect(navigation.getPathname()).toBe('/');
    expect(screen.getByRole('link', { name: 'Open route preview' })).toBeVisible();
  });

  it('resolves a direct dynamic route and permits returning home', async () => {
    const navigation = renderRouter(routes, { initialUrl: '/room/ABCDEF0123' });
    expect(navigation.getPathname()).toBe('/room/ABCDEF0123');
    expect(navigation.getSegments()).toEqual(['room', '[code]']);
    await fireEvent.press(screen.getByRole('link', { name: 'Back to home' }));
    expect(navigation.getPathname()).toBe('/');
  });
});
