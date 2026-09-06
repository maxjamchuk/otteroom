import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { invitationLink, normalizeRoomCode } from '../../src/rooms/code';
jest.mock('expo-linking', () => ({ ...jest.requireActual('expo-linking'), createURL: jest.fn((path: string) => `otteroom:/${path}`) }));
it.each(['ABCDEF0123', 'abcdef0123', ' \tabCdEf0123\n'])('normalizes valid input %#', input => {
  expect(normalizeRoomCode(input)).toBe('ABCDEF0123');
});
it('uses actual browser origin rather than a deployment or runtime host', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'web');
  const previous = Object.getOwnPropertyDescriptor(window, 'location');
  Object.defineProperty(window, 'location', { configurable: true, value: { origin: 'https://room-preview.example:8443' } });
  try { expect(invitationLink('ABCDEF0123')).toBe('https://room-preview.example:8443/room/ABCDEF0123'); }
  finally {
    if (previous) Object.defineProperty(window, 'location', previous);
    else Reflect.deleteProperty(window, 'location');
    platform.restore();
  }
});
it('delegates native link to Expo Linking for the same canonical path', () => {
  expect(invitationLink('ABCDEF0123')).toBe('otteroom://room/ABCDEF0123');
  expect(Linking.createURL).toHaveBeenCalledWith('/room/ABCDEF0123');
});
it('refuses to publish a malformed or noncanonical invitation', () => {
  for (const code of ['bad', 'abcdef0123', ' ABCDEF0123 ']) expect(() => invitationLink(code)).toThrow();
});
it.each([undefined, null, [], ['ABCDEF0123'], '', 'ABCDEF012', 'ABCDEF01234', 'GBCDEF0123', 'ABCD EF0123', '/room/ABCDEF0123'])('rejects malformed input %#', input => {
  expect(normalizeRoomCode(input)).toBeNull();
});
