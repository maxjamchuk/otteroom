import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Path, Rect } from 'react-native-svg';
import { InvitationQr } from '../../src/rooms/invitation-qr';
import { createRoom, joinRoom, refetchRoom } from '../../src/rooms/service';
import { ensureRoomCandidate } from '../../src/candidates/service';

jest.mock('../../src/rooms/service', () => ({
  createRoom: jest.fn(), joinRoom: jest.fn(), refetchRoom: jest.fn(),
}));
jest.mock('../../src/candidates/service', () => ({ ensureRoomCandidate: jest.fn() }));

// Spy through the real encoder; successful rendering never uses a fake matrix.
const encoder = jest.requireActual('qrcode') as {
  create: (value: string, options: { errorCorrectionLevel: string }) => {
    modules: { data: Uint8Array; size: number };
  };
};
const invitation = 'http://localhost:8081/room/ABCDEF0123';
const otherInvitation = 'http://localhost:8081/room/012345ABCD';
const unavailable = 'QR code unavailable. Please try again.';

beforeEach(() => { jest.clearAllMocks(); });
afterEach(() => {
  for (const service of [createRoom, joinRoom, refetchRoom, ensureRoomCandidate]) {
    expect(service).not.toHaveBeenCalled();
  }
  jest.restoreAllMocks();
});

function expectedRenderErrors() {
  return jest.spyOn(console, 'error').mockImplementation(() => {});
}
function expectNoRenderTimeParentUpdate(errors: jest.SpyInstance) {
  expect(errors.mock.calls.some(args => args.some((arg: unknown) => typeof arg === 'string' &&
    /Cannot update a component|while rendering a different component/.test(arg)))).toBe(false);
}

it('requires exactly the invitation value at the public TypeScript boundary', () => {
  const props: ComponentProps<typeof InvitationQr> = { value: invitation };
  // @ts-expect-error An invitation value is mandatory, unlike the library default.
  const missing: ComponentProps<typeof InvitationQr> = {};
  // @ts-expect-error Callers cannot alter the agreed QR rendering options.
  const configurable: ComponentProps<typeof InvitationQr> = { value: invitation, size: 100 };
  expect(props.value).toBe(invitation);
  expect(missing.value).toBeUndefined();
  expect(configurable.value).toBe(invitation);
});

it('renders real local encoder geometry with the exact accessible display contract', () => {
  const create = jest.spyOn(encoder, 'create');
  render(<InvitationQr value={invitation} />);
  expect(create).toHaveBeenCalledWith(invitation, { errorCorrectionLevel: 'M' });
  const matrix = create.mock.results[0].value.modules;
  expect(matrix.size).toBeGreaterThan(0);
  expect(matrix.data).toHaveLength(matrix.size ** 2);
  expect(Array.from(matrix.data)).toEqual(expect.arrayContaining([0, 1]));

  const wrapper = screen.getByRole('image', { name: 'Room invitation QR code' });
  expect(wrapper).toBeVisible();
  expect(StyleSheet.flatten(wrapper.props.style)).toMatchObject({
    width: '100%', maxWidth: 240, alignSelf: 'center',
  });
  const qr = screen.UNSAFE_getByType(QRCode);
  expect(qr.props).toMatchObject({ value: invitation, size: 240, quietZone: 48,
    ecl: 'M', color: 'black', backgroundColor: 'white' });
  expect(qr.props.onError).toBeUndefined();
  expect(qr.props.logo).toBeUndefined();
  expect(qr.props.logoSVG).toBeUndefined();
  expect(qr.props.enableLinearGradient).not.toBe(true);
  expect(screen.UNSAFE_getByType(Svg).props).toMatchObject({
    width: 240, height: 240, viewBox: '-48 -48 336 336',
  });
  expect(screen.UNSAFE_getByType(Rect).props).toMatchObject({
    x: -48, y: -48, width: 336, height: 336, fill: 'white',
  });
  const modules = screen.UNSAFE_getByType(Path).props;
  expect(modules.stroke).toBe('black');
  expect(modules.strokeWidth).toBe(240 / matrix.size);
  expect(modules.d).toMatch(/^M.+L/);
  expect(screen.queryByText(unavailable)).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
});

it('preserves the mounted QR and real geometry when the same value is rendered again', () => {
  const create = jest.spyOn(encoder, 'create');
  const view = render(<InvitationQr value={invitation} />);
  const first = screen.UNSAFE_getByType(QRCode);
  const geometry = screen.UNSAFE_getByType(Path).props.d;
  view.rerender(<InvitationQr value={invitation} />);
  expect(screen.UNSAFE_getByType(QRCode)).toBe(first);
  expect(screen.UNSAFE_getByType(Path).props.d).toBe(geometry);
  expect(create).toHaveBeenCalledTimes(1);
});

it('isolates a changed invitation in a fresh QR with different actual geometry', () => {
  const create = jest.spyOn(encoder, 'create');
  const view = render(<InvitationQr value={invitation} />);
  const first = screen.UNSAFE_getByType(QRCode);
  const geometry = screen.UNSAFE_getByType(Path).props.d;
  view.rerender(<InvitationQr value={otherInvitation} />);
  expect(screen.UNSAFE_getByType(QRCode)).not.toBe(first);
  expect(screen.UNSAFE_getByType(QRCode).props.value).toBe(otherInvitation);
  expect(screen.UNSAFE_getByType(Path).props.d).not.toBe(geometry);
  expect(create.mock.calls.map(args => args[0])).toEqual([invitation, otherInvitation]);
});

it.each(['', 'x'.repeat(3000)])('contains a real encoder rejection without falling back to another value %#', value => {
  const errors = expectedRenderErrors();
  const create = jest.spyOn(encoder, 'create');
  render(<InvitationQr value={value} />);
  expect(screen.getByText(unavailable)).toBeVisible();
  expect(screen.queryByRole('image')).toBeNull();
  expect(screen.getByRole('button', { name: 'Retry QR code' })).toBeVisible();
  expect(create).toHaveBeenCalled();
  expect(create.mock.results.every(result => result.type === 'throw')).toBe(true);
  expect(create.mock.calls.every(args => args[0] === value)).toBe(true);
  expectNoRenderTimeParentUpdate(errors);
});

it('keeps repeated failed retries local and never repairs an invalid invitation', () => {
  const errors = expectedRenderErrors();
  const create = jest.spyOn(encoder, 'create');
  render(<InvitationQr value="" />);
  const before = create.mock.calls.length;
  fireEvent.press(screen.getByRole('button', { name: 'Retry QR code' }));
  expect(create.mock.calls.length).toBeGreaterThan(before);
  expect(create.mock.calls.every(args => args[0] === '')).toBe(true);
  expect(screen.getByText(unavailable)).toBeVisible();
  expect(screen.queryByRole('image')).toBeNull();
  expectNoRenderTimeParentUpdate(errors);
});

it('recovers a transient encoder fault by retrying the exact same value with the real encoder', () => {
  const errors = expectedRenderErrors();
  const realCreate = encoder.create;
  const create = jest.spyOn(encoder, 'create').mockImplementation(() => {
    throw new Error('private encoder diagnostic');
  });
  render(<InvitationQr value={invitation} />);
  expect(screen.getByText(unavailable)).toBeVisible();
  expect(JSON.stringify(screen.toJSON())).not.toContain('private encoder diagnostic');
  create.mockImplementation(realCreate);
  fireEvent.press(screen.getByRole('button', { name: 'Retry QR code' }));
  expect(screen.getByRole('image', { name: 'Room invitation QR code' })).toBeVisible();
  expect(screen.UNSAFE_getByType(Path).props.d).toMatch(/^M.+L/);
  expect(create.mock.calls.every(args => args[0] === invitation)).toBe(true);
  expect(screen.queryByText(unavailable)).toBeNull();
  expectNoRenderTimeParentUpdate(errors);
});

it('contains a downstream SVG render fault and remounts the same QR on explicit retry', () => {
  const errors = expectedRenderErrors();
  const create = jest.spyOn(encoder, 'create');
  const fault = jest.spyOn(Svg.prototype, 'render').mockImplementation(() => {
    throw new Error('private SVG diagnostic');
  });
  render(<View><Text>Independent invitation link remains available</Text><InvitationQr value={invitation} /></View>);
  expect(screen.getByText(unavailable)).toBeVisible();
  expect(screen.getByText('Independent invitation link remains available')).toBeVisible();
  expect(JSON.stringify(screen.toJSON())).not.toContain('private SVG diagnostic');
  fault.mockRestore();
  fireEvent.press(screen.getByRole('button', { name: 'Retry QR code' }));
  expect(screen.getByRole('image', { name: 'Room invitation QR code' })).toBeVisible();
  expect(screen.UNSAFE_getByType(Path).props.d).toMatch(/^M.+L/);
  expect(create.mock.calls.every(args => args[0] === invitation)).toBe(true);
  expectNoRenderTimeParentUpdate(errors);
});

it('clears the failed boundary when its value changes and cannot resurrect the old QR', () => {
  const errors = expectedRenderErrors();
  const view = render(<InvitationQr value="" />);
  expect(screen.getByText(unavailable)).toBeVisible();
  view.rerender(<InvitationQr value={otherInvitation} />);
  expect(screen.queryByText(unavailable)).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.UNSAFE_getByType(QRCode).props.value).toBe(otherInvitation);
  expect(screen.UNSAFE_getByType(Path).props.d).toMatch(/^M.+L/);
  expectNoRenderTimeParentUpdate(errors);
});

it('contains one invitation failure without hiding a separately mounted valid invitation', () => {
  const errors = expectedRenderErrors();
  render(<View><InvitationQr value="" /><InvitationQr value={invitation} /></View>);
  expect(screen.getByText(unavailable)).toBeVisible();
  const healthy = screen.UNSAFE_getByType(QRCode);
  fireEvent.press(screen.getByRole('button', { name: 'Retry QR code' }));
  expect(screen.UNSAFE_getByType(QRCode)).toBe(healthy);
  expect(healthy.props.value).toBe(invitation);
  expect(screen.getByRole('image', { name: 'Room invitation QR code' })).toBeVisible();
  expectNoRenderTimeParentUpdate(errors);
});
