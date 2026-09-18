import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-reanimated', () => {
  const mock = jest.requireActual('react-native-reanimated/mock');

  return {
    ...mock,
    default: {
      ...mock.default,
      call: jest.fn(),
    },
    runOnJS: (callback: (...args: unknown[]) => unknown) => callback,
  };
});

type SharedValue<T> = {
  get: () => T;
  set: (next: T | ((current: T) => T)) => void;
  value: T;
};

export function createDecisionSharedValue<T>(initial: T): SharedValue<T> {
  let current = initial;

  return {
    get: () => current,
    set: (next) => {
      current = typeof next === 'function'
        ? (next as (value: T) => T)(current)
        : next;
    },
    get value() {
      return current;
    },
    set value(next: T) {
      current = next;
    },
  };
}

export function createDecisionGestureCallbacks<T extends Record<string, unknown>>() {
  const callbacks = new Map<keyof T, (...args: unknown[]) => unknown>();

  return {
    capture<K extends keyof T>(name: K, callback: (...args: unknown[]) => unknown) {
      callbacks.set(name, callback);
      return this;
    },
    invoke<K extends keyof T>(name: K, ...args: unknown[]) {
      const callback = callbacks.get(name);
      if (!callback) {
        throw new Error(`Decision gesture callback ${String(name)} was not captured.`);
      }
      return callback(...args);
    },
  };
}
