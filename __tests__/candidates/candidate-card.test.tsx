import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Image, StyleSheet } from 'react-native';
import { CandidateCard } from '../../src/candidates/candidate-card';
import { useRoomCandidate } from '../../src/candidates/use-room-candidate';
import * as posters from '../../src/candidates/posters';
import type { AcceptedRoomState } from '../../src/rooms/state';

const mockRpc = jest.fn(), mockBootstrap = jest.fn(), mockFrom = jest.fn(), mockChannel = jest.fn();
jest.mock('../../src/lib/supabase', () => ({ getSupabase: () => ({ rpc: mockRpc, from: mockFrom, channel: mockChannel }) }));
jest.mock('../../src/auth/anonymous-session', () => ({ bootstrapAnonymousSession: () => mockBootstrap() }));
const ready: AcceptedRoomState = { kind: 'accepted', id: '11111111-1111-4111-8111-111111111111', code: 'ABCDEF0123', isCreator: true, isVoter: true, state: 'ready', title: 'Ready', voterCount: 2, requiredVoterCount: 2, filterCompletedCount: 0, filtersComplete: false };
const row = { outcome: 'available', candidate_id: 'fixture-cardboard-comet', title: 'The Cardboard Comet', release_year: 2020, poster_key: 'cardboard-comet' };
const success = { data: [row], error: null };
const failureMessage = 'Unable to load this movie. Please try again.';
let current: ReturnType<typeof useRoomCandidate>;

function Harness({ room }: { room: AcceptedRoomState | null }) {
  current = useRoomCandidate(room);
  return <CandidateCard model={current} />;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function mount(room: AcceptedRoomState | null = ready) {
  const view = render(<Harness room={room} />);
  await act(async () => {});
  return view;
}
function expectMetadata() {
  expect(screen.getByText(row.title)).toBeVisible();
  expect(screen.getByText(String(row.release_year))).toBeVisible();
  expect(JSON.stringify(screen.toJSON())).not.toContain(row.candidate_id);
  expect(JSON.stringify(screen.toJSON())).not.toContain(ready.id);
}
beforeEach(() => {
  jest.clearAllMocks();
  mockRpc.mockReset().mockResolvedValue(success);
  mockBootstrap.mockReset().mockResolvedValue({ user: { id: 'retained-participant' } });
});
afterEach(() => {
  expect(mockFrom).not.toHaveBeenCalled(); expect(mockChannel).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});

it.each([null, { ...ready, state: 'waiting', title: 'Waiting', voterCount: 1, requiredVoterCount: 2 } as AcceptedRoomState])('renders nothing for an inactive room %#', async room => {
  await mount(room);
  expect(screen.toJSON()).toBeNull();
  expect(mockRpc).not.toHaveBeenCalled(); expect(mockBootstrap).not.toHaveBeenCalled();
});
it('shows explicit loading without speculative metadata or an image while acquisition is pending', async () => {
  const pending = deferred<typeof success>(); mockRpc.mockReturnValue(pending.promise);
  await mount();
  expect(screen.getByText('Loading movie…')).toBeVisible();
  expect(screen.getByTestId('candidate-card')).toHaveProp('accessibilityState', { busy: true });
  expect(screen.queryByText(row.title)).toBeNull(); expect(screen.queryByRole('image')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
  await act(async () => { pending.resolve(success); });
  expectMetadata();
});
it('renders only title/year and an accessible bounded local poster, never internal IDs or future controls', async () => {
  await mount();
  expectMetadata();
  const image = screen.UNSAFE_getByType(Image);
  expect(screen.getByRole('image', { name: `Poster for ${row.title}` })).toBeVisible();
  expect(image.props.source).toBe(posters.resolveCandidatePoster(row.poster_key));
  expect(StyleSheet.flatten(image.props.style)).toMatchObject({ width: '100%', maxWidth: 240, aspectRatio: 2 / 3 });
  expect(image.props.resizeMode).toBe('contain');
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  expect(screen.queryAllByRole('link')).toHaveLength(0);
});
it('remains explicitly incomplete until current Image onLoad, never onLoadEnd', async () => {
  await mount();
  const poster = screen.getByTestId('candidate-poster');
  expect(screen.getByText('Loading movie…')).toBeVisible();
  fireEvent(poster, 'loadEnd');
  expect(current.status).toBe('loading');
  expect(screen.getByText('Loading movie…')).toBeVisible();
  fireEvent(poster, 'load', { nativeEvent: { source: { width: 240, height: 360 } } });
  expect(current.status).toBe('available');
  expect(screen.queryByText('Loading movie…')).toBeNull();
  expect(screen.getByTestId('candidate-card')).toHaveProp('accessibilityState', { busy: false });
  expectMetadata();
});
it.each(['transport', 'not_ready', 'not_found'])('shows safe %s acquisition failure and retries only the same room', async outcome => {
  if (outcome === 'transport') mockRpc.mockRejectedValueOnce(new Error('private backend details'));
  else mockRpc.mockResolvedValueOnce({ data: [{ outcome, candidate_id: null, title: null, release_year: null, poster_key: null }], error: null });
  const pending = deferred<typeof success>(); mockRpc.mockReturnValueOnce(pending.promise);
  await mount();
  expect(screen.getByText(failureMessage)).toBeVisible();
  expect(screen.queryByRole('image')).toBeNull(); expect(screen.queryByText(row.title)).toBeNull();
  expect(JSON.stringify(screen.toJSON())).not.toContain('private backend details');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Retry candidate' })); });
  expect(screen.getByText('Loading movie…')).toBeVisible();
  expect(screen.queryByRole('button')).toBeNull();
  expect(mockRpc.mock.calls).toEqual(Array(2).fill(['ensure_room_candidate', { p_room_id: ready.id }]));
  await act(async () => { pending.resolve(success); });
  expectMetadata(); expect(screen.queryByText(failureMessage)).toBeNull();
  expect(current.status).toBe('loading');
});

it('preserves metadata on poster failure and remounts the same source on retry without RPC or Auth work', async () => {
  await mount();
  const first = screen.UNSAFE_getByType(Image), source = first.props.source;
  const oldLoad = first.props.onLoad, oldError = first.props.onError, anchor = current.candidate;
  const before = { rpc: mockRpc.mock.calls.length, auth: mockBootstrap.mock.calls.length };
  fireEvent(screen.getByTestId('candidate-poster'), 'error', { nativeEvent: { error: 'private image failure' } });
  expectMetadata(); expect(current.candidate).toBe(anchor); expect(current.status).toBe('poster-error');
  expect(screen.getByText(failureMessage)).toBeVisible();
  expect(JSON.stringify(screen.toJSON())).not.toContain('private image failure');
  expect(screen.queryByText('Loading movie…')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Retry candidate' }));
  const retried = screen.UNSAFE_getByType(Image);
  expect(retried).not.toBe(first); expect(retried.props.source).toBe(source);
  expect(current.candidate).toBe(anchor); expect(current.posterAttempt).toBe(1); expect(current.requestAttempt).toBe(0);
  expect(screen.getByText('Loading movie…')).toBeVisible(); expect(screen.queryByText(failureMessage)).toBeNull();
  act(() => { oldLoad(); oldError(); });
  expect(current.status).toBe('loading');
  fireEvent(screen.getByTestId('candidate-poster'), 'loadEnd');
  expect(screen.getByText('Loading movie…')).toBeVisible();
  fireEvent(screen.getByTestId('candidate-poster'), 'load', { nativeEvent: { source: { width: 240, height: 360 } } });
  expect(current.status).toBe('available'); expectMetadata();
  expect(screen.queryByText('Loading movie…')).toBeNull(); expect(screen.queryByRole('button')).toBeNull();
  act(() => { oldError(); });
  expect(current.status).toBe('available'); expect(current.candidate).toBe(anchor);
  expect(mockRpc).toHaveBeenCalledTimes(before.rpc); expect(mockBootstrap).toHaveBeenCalledTimes(before.auth);
  expect(mockRpc.mock.calls).toEqual([['ensure_room_candidate', { p_room_id: ready.id }]]);
});
it('keeps unknown-key metadata with a safe retry and no substitute image or acquisition', async () => {
  mockRpc.mockResolvedValue({ data: [{ ...row, poster_key: 'unknown-poster' }], error: null });
  await mount();
  const anchor = current.candidate;
  expectMetadata(); expect(screen.getByText(failureMessage)).toBeVisible();
  expect(screen.queryByRole('image')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Retry candidate' }));
  expect(current.candidate).toBe(anchor); expect(current.posterAttempt).toBe(1);
  expect(screen.getByText(failureMessage)).toBeVisible(); expect(screen.queryByRole('image')).toBeNull();
  expect(JSON.stringify(screen.toJSON())).not.toContain('unknown-poster');
  expect(mockRpc).toHaveBeenCalledTimes(1); expect(mockBootstrap).toHaveBeenCalledTimes(1);
});
it('recovers a same-key configuration failure only after the retried Image emits onLoad', async () => {
  const resolve = jest.spyOn(posters, 'resolveCandidatePoster');
  resolve.mockImplementationOnce(() => { throw new Error('private configuration'); });
  await mount();
  const anchor = current.candidate;
  expect(screen.getByText(failureMessage)).toBeVisible(); expect(screen.queryByRole('image')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Retry candidate' }));
  expect(screen.getByText('Loading movie…')).toBeVisible(); expect(current.candidate).toBe(anchor);
  fireEvent(screen.getByTestId('candidate-poster'), 'load');
  expect(current.status).toBe('available'); expectMetadata();
  expect(resolve.mock.calls).toEqual([[row.poster_key], [row.poster_key]]);
  expect(mockRpc).toHaveBeenCalledTimes(1); expect(mockBootstrap).toHaveBeenCalledTimes(1);
});
it('keeps the mounted image and callbacks stable across harmless Ready refetches', async () => {
  const view = await mount();
  fireEvent(screen.getByTestId('candidate-poster'), 'load');
  const first = screen.UNSAFE_getByType(Image), onLoad = first.props.onLoad, onError = first.props.onError;
  const anchor = current.candidate;
  view.rerender(<Harness room={{ ...ready }} />);
  const same = screen.UNSAFE_getByType(Image);
  expect(same).toBe(first); expect(same.props.onLoad).toBe(onLoad); expect(same.props.onError).toBe(onError);
  expect(current.candidate).toBe(anchor); expect(current.status).toBe('available');
  expect(screen.queryByText('Loading movie…')).toBeNull(); expect(mockRpc).toHaveBeenCalledTimes(1);
});
it('ignores an old room image after the current room has loaded', async () => {
  const view = await mount(), old = screen.UNSAFE_getByType(Image);
  const oldLoad = old.props.onLoad, oldError = old.props.onError;
  const other = { ...ready, id: '22222222-2222-4222-8222-222222222222', code: '012345ABCD' };
  const otherRow = { ...row, candidate_id: 'fixture-clockwork-orchard', title: 'The Clockwork Orchard', release_year: 2023, poster_key: 'clockwork-orchard' };
  mockRpc.mockResolvedValueOnce({ data: [otherRow], error: null });
  await act(async () => { view.rerender(<Harness room={other} />); });
  fireEvent(screen.getByTestId('candidate-poster'), 'load');
  act(() => { oldError(); oldLoad(); });
  expect(current.status).toBe('available'); expect(current.candidate?.candidate_id).toBe(otherRow.candidate_id);
  expect(screen.getByText(otherRow.title)).toBeVisible(); expect(screen.getByText('2023')).toBeVisible();
  expect(screen.queryByText(row.title)).toBeNull(); expect(screen.queryByText(failureMessage)).toBeNull();
  expect(JSON.stringify(screen.toJSON())).not.toContain(otherRow.candidate_id);
  expect(mockRpc.mock.calls).toEqual([['ensure_room_candidate', { p_room_id: ready.id }], ['ensure_room_candidate', { p_room_id: other.id }]]);
});
it('retains a successfully displayed candidate if its current poster subsequently reports an error', async () => {
  await mount();
  fireEvent(screen.getByTestId('candidate-poster'), 'load');
  const anchor = current.candidate;
  fireEvent(screen.getByTestId('candidate-poster'), 'error');
  expect(current.status).toBe('poster-error'); expect(current.candidate).toBe(anchor);
  expectMetadata(); expect(screen.getByText(failureMessage)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Retry candidate' })).toBeVisible();
  expect(mockRpc).toHaveBeenCalledTimes(1);
});

it.each([[true,true],[true,false],[false,true]] as const)('same local poster/retry for generalized creator=%s voter=%s',async(isCreator,isVoter)=>{
  const room=Object.freeze({...ready,isCreator,isVoter,voterCount:3,requiredVoterCount:3});
  await mount(room);expectMetadata();
  const source=screen.getByTestId('candidate-poster').props.source;
  fireEvent(screen.getByTestId('candidate-poster'),'error');
  fireEvent.press(screen.getByRole('button',{name:'Retry candidate'}));
  expect(screen.getByTestId('candidate-poster').props.source).toBe(source);
  fireEvent(screen.getByTestId('candidate-poster'),'load');
  expectMetadata();expect(current.status).toBe('available');
  expect(mockRpc.mock.calls).toEqual([['ensure_room_candidate',{p_room_id:room.id}]]);
  expect(room.voterCount).toBe(3);expect(room.isVoter).toBe(isVoter);
});
