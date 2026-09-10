import { narrowCreateResult, narrowJoinResult, RoomContractError } from '../../src/rooms/contracts';

const accepted = { outcome: 'created', room_id: '11111111-1111-4111-8111-111111111111', room_code: 'ABCDEF0123',
  is_creator: true, is_voter: true, room_state: 'waiting', voter_count: 1, required_voter_count: 2 };

it.each([[2, true], [3, true], [2, false], [3, false]] as const)('accepts explicit target%s creator-voter=%s creation', (target, voting) => {
  const row = { ...accepted, required_voter_count: target, is_voter: voting, voter_count: voting ? 1 : 0 };
  expect(narrowCreateResult([row])).toEqual(row);
  expect(narrowCreateResult([{ ...row, outcome: 'already_created' }])).toEqual({ ...row, outcome: 'already_created' });
});
it.each([true, false])('accepts original creation recovery at intermediate Waiting and Ready, voting=%s', is_voter => {
  for (const voter_count of [2, 3]) {
    const row = { ...accepted, outcome: 'already_created', is_voter, required_voter_count: 3,
      voter_count, room_state: voter_count === 3 ? 'ready' : 'waiting' };
    expect(narrowCreateResult([row])).toEqual(row);
    expect(() => narrowCreateResult([{ ...row, outcome: 'created' }])).toThrow(RoomContractError);
  }
});
it.each([undefined, null, {}, [], [accepted, accepted], [null], ['created']])('rejects non-single-row data %#', value => {
  expect(() => narrowCreateResult(value)).toThrow(RoomContractError);
  expect(() => narrowJoinResult(value)).toThrow(RoomContractError);
});
it.each([
  { outcome: 'unknown' }, { outcome: 'joined' }, { room_id: null }, { room_id: 'not-a-uuid' },
  { room_code: 'abcdef0123' }, { room_code: ' ABCDEF0123 ' }, { room_code: null }, { room_code: 'GBCDEF0123' },
  { is_creator: false }, { is_creator: null }, { is_creator: 'true' }, { is_voter: null }, { is_voter: 1 },
  { room_state: 'closed' }, { room_state: null }, { room_state: 'ready' },
  { voter_count: '1' }, { voter_count: null }, { voter_count: 1.5 }, { voter_count: 0 }, { voter_count: -1 },
  { voter_count: 2 }, { voter_count: 3 }, { voter_count: NaN }, { voter_count: Infinity },
  { required_voter_count: 1 }, { required_voter_count: null }, { required_voter_count: '2' },
  { required_voter_count: 2.5 }, { required_voter_count: 2147483648 }, { required_voter_count: NaN },
  { private_field: 'unexpected' }, { participant_role: 'host' },
])('rejects inconsistent create field %#', patch => {
  expect(() => narrowCreateResult([{ ...accepted, ...patch }])).toThrow(RoomContractError);
});
it('requires all eight fields and rejects null, omissions and extra data for accepted outcomes', () => {
  for (const [parser, outcome, is_creator] of [[narrowCreateResult, 'created', true], [narrowJoinResult, 'joined', false],
    [narrowJoinResult, 'already_member', true]] as const) {
    const row = { ...accepted, outcome, is_creator, required_voter_count: 3 };
    for (const field of Object.keys(row)) {
      const missing: Record<string, unknown> = { ...row }; delete missing[field];
      expect(() => parser([missing])).toThrow(RoomContractError);
      expect(() => parser([{ ...row, [field]: null }])).toThrow(RoomContractError);
    }
    expect(() => parser([{ ...row, extra: true }])).toThrow(RoomContractError);
  }
});
it.each([[true, true], [true, false], [false, true]] as const)('accepts legitimate member creator=%s voter=%s before/after assembly', (is_creator, is_voter) => {
  for (const voter_count of [is_voter ? 1 : 0, 2, 3]) {
    const row = { ...accepted, outcome: 'already_member', is_creator, is_voter, required_voter_count: 3,
      voter_count, room_state: voter_count === 3 ? 'ready' : 'waiting' };
    expect(narrowJoinResult([row])).toEqual(row);
    if (!is_creator) expect(narrowJoinResult([{ ...row, outcome: 'joined' }]).outcome).toBe('joined');
  }
});
it('allows technical integer bound without an arbitrary product maximum', () => {
  const row = { ...accepted, required_voter_count: 2147483647 };
  expect(narrowCreateResult([row])).toEqual(row);
  expect(narrowJoinResult([{ ...row, outcome: 'already_member', voter_count: 2147483647, room_state: 'ready' }]).outcome).toBe('already_member');
});
it.each([
  { is_creator: false, is_voter: false }, { is_voter: true, voter_count: 0 },
  { is_creator: 'false' }, { is_voter: 'true' }, { room_state: 'ready' },
  { voter_count: 3 }, { voter_count: -1 }, { voter_count: 0.5 }, { required_voter_count: 2147483648 },
  { outcome: 'created' }, { outcome: 'future' },
])('rejects impossible member projection %#', patch => {
  expect(() => narrowJoinResult([{ ...accepted, outcome: 'already_member', ...patch }])).toThrow(RoomContractError);
});
it('new join is a non-creator voter only; no implicit creator promotion', () => {
  for (const [is_creator, is_voter] of [[true, true], [true, false], [false, false]]) {
    expect(() => narrowJoinResult([{ ...accepted, outcome: 'joined', is_creator, is_voter }])).toThrow(RoomContractError);
  }
});
it.each(['invalid_code', 'not_found', 'full'])('requires exact seven NULLs for %s and no partial disclosure', outcome => {
  const rejected = { outcome, room_id: null, room_code: null, room_state: null,
    is_creator: null, is_voter: null, voter_count: null, required_voter_count: null };
  expect(narrowJoinResult([rejected])).toEqual(rejected);
  for (const field of Object.keys(rejected).filter(key => key !== 'outcome')) {
    expect(() => narrowJoinResult([{ ...rejected, [field]: accepted[field as keyof typeof accepted] }])).toThrow(RoomContractError);
    const missing: Record<string, unknown> = { ...rejected }; delete missing[field];
    expect(() => narrowJoinResult([missing])).toThrow(RoomContractError);
  }
  expect(() => narrowCreateResult([rejected])).toThrow(RoomContractError);
});
