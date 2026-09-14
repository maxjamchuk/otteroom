export function assert(value: unknown, message = 'assertion failed'): asserts value {
  if (!value) throw new Error(message);
}

export function assertFalse(value: unknown, message = 'expected false'): void {
  if (value) throw new Error(message);
}

export function assertEquals(actual: unknown, expected: unknown): void {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) throw new Error(`expected ${right}, received ${left}`);
}

export function assertThrows(operation: () => unknown): void {
  try { operation(); } catch { return; }
  throw new Error('expected operation to throw');
}
