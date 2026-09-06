import 'expo-sqlite/localStorage/install';

function access<T>(action: (storage: Storage) => T): T {
  try {
    const storage = globalThis.localStorage;
    if (!storage) throw new Error();
    return action(storage);
  } catch { throw new Error('Local session storage is unavailable.'); }
}

export const authStorage = {
  getItem(key: string): string | null { return access(storage => storage.getItem(key)); },
  setItem(key: string, value: string): void { access(storage => storage.setItem(key, value)); },
  removeItem(key: string): void { access(storage => storage.removeItem(key)); },
};
