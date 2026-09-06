import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export function normalizeRoomCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const code = input.trim().toUpperCase();
  return /^[0-9A-F]{10}$/.test(code) ? code : null;
}

export function invitationLink(code: string): string {
  if (normalizeRoomCode(code) !== code) throw new Error('Invalid invitation code.');
  const path = `/room/${code}`;
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') throw new Error('Invitation requires a mounted client.');
    return new URL(path, window.location.origin).href;
  }
  return Linking.createURL(path);
}
