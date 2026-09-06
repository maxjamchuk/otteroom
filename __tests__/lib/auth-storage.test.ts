/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const values = new Map<string, string>();
const storage = {
  getItem: jest.fn((key: string) => values.get(key) ?? null),
  setItem: jest.fn((key: string, value: string) => { values.set(key, value); }),
  removeItem: jest.fn((key: string) => { values.delete(key); }),
};

function browser() {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
}
beforeEach(() => { jest.resetModules(); values.clear(); jest.clearAllMocks(); });
afterEach(() => {
  for (const [key, descriptor] of [['window', originalWindow], ['localStorage', originalStorage]] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

it('web import is lazy and non-browser export is synchronous read-null/no-op', () => {
  Reflect.deleteProperty(globalThis, 'window');
  const getter = jest.fn(() => { throw new Error('must not access Node storage'); });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: getter });
  const { authStorage } = require('../../src/lib/auth-storage.web');
  expect(getter).not.toHaveBeenCalled();
  expect(authStorage.getItem('key')).toBeNull();
  expect(authStorage.setItem('key', 'synthetic')).toBeUndefined();
  expect(authStorage.removeItem('key')).toBeUndefined();
  expect(getter).not.toHaveBeenCalled();
});

it('web persists synchronously across adapter reevaluation and removes explicitly', () => {
  browser();
  let adapter = require('../../src/lib/auth-storage.web').authStorage;
  expect(adapter.setItem('key', 'synthetic')).toBeUndefined();
  jest.resetModules();
  adapter = require('../../src/lib/auth-storage.web').authStorage;
  expect(adapter.getItem('key')).toBe('synthetic');
  expect(adapter.removeItem('key')).toBeUndefined();
  expect(adapter.getItem('key')).toBeNull();
});

it.each(['missing', 'getter', 'method'])('web storage failures remain recoverable and value-free (%s)', mode => {
  browser();
  if (mode === 'missing') Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true });
  if (mode === 'getter') Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('sensitive'); } });
  if (mode === 'method') Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem() { throw new Error('sensitive'); }, setItem() { throw new Error('sensitive'); }, removeItem() { throw new Error('sensitive'); },
  } });
  const adapter = require('../../src/lib/auth-storage.web').authStorage;
  for (const action of [() => adapter.getItem('key'), () => adapter.setItem('key', 'synthetic'), () => adapter.removeItem('key')]) {
    expect(action).toThrow('Local session storage is unavailable.');
  }
});

it('native installs SQLite storage only on native and preserves synchronous persistence', () => {
  const install = jest.fn(() => { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage }); });
  jest.doMock('expo-sqlite/localStorage/install', install);
  let adapter = require('../../src/lib/auth-storage.native').authStorage;
  expect(install).toHaveBeenCalledTimes(1);
  expect(adapter.setItem('key', 'synthetic')).toBeUndefined();
  jest.resetModules();
  adapter = require('../../src/lib/auth-storage.native').authStorage;
  expect(adapter.getItem('key')).toBe('synthetic');
  expect(adapter.removeItem('key')).toBeUndefined();
  expect(adapter.getItem('key')).toBeNull();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('sensitive'); } });
  expect(() => adapter.getItem('key')).toThrow('Local session storage is unavailable.');
});

it('Metro actually selects web and native adapters without SQLite in the web dependency path', () => {
  const { resolve } = require('metro-resolver');
  const directory = path.resolve('src/lib');
  const context = {
    originModulePath: path.join(directory, 'supabase.ts'),
    allowHaste: false, preferNativePlatform: true, sourceExts: ['ts', 'tsx', 'js'],
    mainFields: ['react-native', 'browser', 'main'],
    fileSystemLookup: (file: string) => fs.existsSync(file) ? { exists: true, type: fs.statSync(file).isDirectory() ? 'd' : 'f', realPath: file } : { exists: false },
    doesFileExist: fs.existsSync, isAssetFile: () => false, redirectModulePath: (file: string) => file,
    getPackageForModule: () => null,
  };
  expect(resolve(context, './auth-storage', 'web').filePath).toBe(path.join(directory, 'auth-storage.web.ts'));
  for (const platform of ['ios', 'android']) expect(resolve(context, './auth-storage', platform).filePath).toBe(path.join(directory, 'auth-storage.native.ts'));
  const install = jest.fn(() => { throw new Error('SQLite must not load for web'); });
  jest.doMock('expo-sqlite/localStorage/install', install);
  require('../../src/lib/auth-storage.web');
  expect(install).not.toHaveBeenCalled();
});
