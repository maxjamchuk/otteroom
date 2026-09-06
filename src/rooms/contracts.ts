import type { Database } from '../types/database.generated';
import { normalizeRoomCode } from './code';

type Functions = Database['public']['Functions'];
type GeneratedRow = Functions['create_room']['Returns'][number] & Functions['join_room']['Returns'][number];
type Identity = Pick<GeneratedRow, 'room_id' | 'room_code'>;
type Host = Identity & { participant_role: 'host' } & (
  { room_state: 'waiting'; participant_count: 1 } | { room_state: 'ready'; participant_count: 2 }
);
type Guest = Identity & { participant_role: 'guest'; room_state: 'ready'; participant_count: 2 };
export type CreateResult =
  | Identity & { outcome: 'created'; participant_role: 'host'; room_state: 'waiting'; participant_count: 1 }
  | Host & { outcome: 'already_created' };
export type AcceptedJoinResult = Guest & { outcome: 'joined' } | (Host | Guest) & { outcome: 'already_member' };
type RejectedJoinResult = { outcome: 'invalid_code' | 'not_found' | 'full' } & {
  [K in Exclude<keyof GeneratedRow, 'outcome'>]: null
};
export type JoinResult = AcceptedJoinResult | RejectedJoinResult;
export type AcceptedRoomResult = CreateResult | AcceptedJoinResult;

export class RoomContractError extends Error {
  constructor() { super('Unable to read room information. Please try again.'); this.name = 'RoomContractError'; }
}

const fields = ['outcome', 'room_id', 'room_code', 'room_state', 'participant_role', 'participant_count'] as const satisfies readonly (keyof GeneratedRow)[];
function oneRow(data: unknown): Record<keyof GeneratedRow, unknown> {
  if (!Array.isArray(data) || data.length !== 1) throw new RoomContractError();
  const row: unknown = data[0];
  if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).length !== fields.length ||
      !fields.every(key => Object.hasOwn(row, key))) throw new RoomContractError();
  return row as Record<keyof GeneratedRow, unknown>;
}
function accepted(row: Record<keyof GeneratedRow, unknown>): void {
  if (typeof row.room_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.room_id) ||
      typeof row.room_code !== 'string' || normalizeRoomCode(row.room_code) !== row.room_code ||
      !((row.room_state === 'waiting' && row.participant_count === 1 && row.participant_role === 'host') ||
        (row.room_state === 'ready' && row.participant_count === 2 && (row.participant_role === 'host' || row.participant_role === 'guest')))) {
    throw new RoomContractError();
  }
}
export function narrowCreateResult(data: unknown): CreateResult {
  const row = oneRow(data);
  accepted(row);
  if (row.participant_role !== 'host' || !(
    row.outcome === 'already_created' || row.outcome === 'created' && row.room_state === 'waiting'
  )) throw new RoomContractError();
  return row as CreateResult;
}
export function narrowJoinResult(data: unknown): JoinResult {
  const row = oneRow(data);
  if (row.outcome === 'invalid_code' || row.outcome === 'not_found' || row.outcome === 'full') {
    if (!fields.filter(key => key !== 'outcome').every(key => row[key] === null)) throw new RoomContractError();
  } else {
    accepted(row);
    if (!(row.outcome === 'already_member' || row.outcome === 'joined' && row.participant_role === 'guest')) throw new RoomContractError();
  }
  return row as JoinResult;
}
