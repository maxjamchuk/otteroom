import { narrowCreateResult, narrowJoinResult, RoomContractError } from '../../src/rooms/contracts';

const accepted = { outcome: 'created', room_id: '11111111-1111-4111-8111-111111111111', room_code: 'ABCDEF0123', participant_role: 'host', room_state: 'waiting', participant_count: 1 };

it.each(['created', 'already_created'])('accepts exact %s host Waiting projection', outcome => {
  expect(narrowCreateResult([{ ...accepted, outcome }])).toEqual({ ...accepted, outcome });
});
it('accepts authoritative Ready only for recovered creation', () => {
  const ready = { ...accepted, outcome: 'already_created', room_state: 'ready', participant_count: 2 };
  expect(narrowCreateResult([ready])).toEqual(ready);
  expect(() => narrowCreateResult([{ ...ready, outcome: 'created' }])).toThrow(RoomContractError);
});
it.each([undefined, null, {}, [], [accepted, accepted], [null], ['created']])('rejects non-single-row data %#', value => {
  expect(() => narrowCreateResult(value)).toThrow(RoomContractError);
  expect(() => narrowJoinResult(value)).toThrow(RoomContractError);
});
it.each([
  { outcome: 'unknown' }, { outcome: 'joined' }, { room_id: null }, { room_id: 'not-a-uuid' },
  { room_code: 'abcdef0123' }, { room_code: ' ABCDEF0123 ' }, { room_code: null },
  { participant_role: 'guest' }, { participant_role: null }, { room_state: 'closed' },
  { room_state: null }, { participant_count: '1' }, { participant_count: 2 },
  { participant_count: null }, { participant_count: 1.5 }, { private_field: 'unexpected' },
])('rejects inconsistent create field %#', patch => {
  expect(() => narrowCreateResult([{ ...accepted, ...patch }])).toThrow(RoomContractError);
});
it('rejects omitted output fields', () => {
  for (const field of Object.keys(accepted)) {
    const value: Record<string, unknown> = { ...accepted };
    delete value[field];
    expect(() => narrowCreateResult([value])).toThrow(RoomContractError);
  }
});
it.each([['waiting', 1], ['ready', 2]])('recovers host in %s', (room_state, participant_count) => {
  const row = { ...accepted, outcome: 'already_member', room_state, participant_count };
  expect(narrowJoinResult([row])).toEqual(row);
});
it('closes shared join role/count/nullability without guest UI', () => {
  const guest = { ...accepted, outcome: 'joined', participant_role: 'guest', room_state: 'ready', participant_count: 2 };
  expect(narrowJoinResult([guest])).toEqual(guest);
  expect(narrowJoinResult([{ ...guest, outcome: 'already_member' }]).outcome).toBe('already_member');
  for (const patch of [{ participant_role: 'host' }, { participant_count: 1 }, { room_state: 'waiting' }]) {
    expect(() => narrowJoinResult([{ ...guest, ...patch }])).toThrow(RoomContractError);
  }
  expect(() => narrowJoinResult([{ ...accepted, outcome: 'already_member', participant_role: 'guest' }])).toThrow(RoomContractError);
  for (const outcome of ['invalid_code', 'not_found', 'full']) {
    const rejected = { outcome, room_id: null, room_code: null, room_state: null, participant_role: null, participant_count: null };
    expect(narrowJoinResult([rejected])).toEqual(rejected);
    for (const field of Object.keys(rejected).filter(key => key !== 'outcome')) {
      expect(() => narrowJoinResult([{ ...rejected, [field]: accepted[field as keyof typeof accepted] }])).toThrow(RoomContractError);
    }
  }
  expect(() => narrowJoinResult([{ ...accepted, outcome: 'future' }])).toThrow(RoomContractError);
});
