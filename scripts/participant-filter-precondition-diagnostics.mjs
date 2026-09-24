export const participantFilterPreconditionIds = Object.freeze([
  'arguments',
  'runtime-resolution',
  'config-read',
  'config-project-match',
  'config-schemas-match',
  'lock-create',
  'container-inspect',
  'container-running',
  'container-project-match',
  'port-8081-probe',
  'port-8081-free',
  'browser-containers-query',
  'browser-containers-empty',
  'database-baseline-query',
  'database-baseline-parse',
  'database-rooms-empty',
  'database-auth-users-empty',
  'database-no-active-clients',
  'database-no-anon-auth-clients',
  'project-local-cli',
  'generated-types-readable',
]);

const identifiers = new Set(participantFilterPreconditionIds);
const safeObservationKeys = new Set([
  'project_match',
  'schemas_match',
  'container_running',
  'container_project_match',
  'port_free',
  'browser_container_count',
  'room_count',
  'auth_user_count',
  'active_client_session_count',
  'anon_auth_client_session_count',
  'cli_resolves',
  'types_readable',
]);

// Diagnostics are limited to a known check name and boolean/count observations.
// Callers cannot accidentally attach raw command output, paths, or environment values.
export function classifyParticipantFilterPrecondition(id, observed = {}) {
  if (!identifiers.has(id) || !observed || typeof observed !== 'object' || Array.isArray(observed)) {
    throw new Error('PARTICIPANT_FILTER_DIAGNOSTIC_REJECTED');
  }

  const fields = Object.entries(observed).sort(([left], [right]) => left.localeCompare(right));
  if (fields.some(([key, value]) => !safeObservationKeys.has(key) ||
      !(typeof value === 'boolean' || (Number.isSafeInteger(value) && value >= 0)))) {
    throw new Error('PARTICIPANT_FILTER_DIAGNOSTIC_REJECTED');
  }

  const suffix = fields.map(([key, value]) => `${key}=${value}`).join(' ');
  return `check=${id}${suffix ? ` ${suffix}` : ''}`;
}
