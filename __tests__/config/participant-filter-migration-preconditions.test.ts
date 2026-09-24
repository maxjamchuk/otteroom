/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const validator = fs.readFileSync('scripts/check-participant-filters-migration.mjs', 'utf8');
const diagnostics = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
  const module = await import(process.argv[1]);
  const ids = module.participantFilterPreconditionIds;
  const classifications = ids.map(id => module.classifyParticipantFilterPrecondition(id));
  const sample = module.classifyParticipantFilterPrecondition('database-rooms-empty', { room_count: 2 });
  const boolean = module.classifyParticipantFilterPrecondition('container-project-match', { container_project_match: false });
  const cli = module.classifyParticipantFilterPrecondition('project-local-cli', { cli_resolves: false });
  const types = module.classifyParticipantFilterPrecondition('generated-types-readable', { types_readable: false });
  const rejected = [];
  for (const [id, observed] of [
    ['database-rooms-empty', { connection_string: 'postgres://private' }],
    ['database-rooms-empty', { room_count: 'room-id' }],
    ['unknown-precondition', {}],
  ]) {
    try { module.classifyParticipantFilterPrecondition(id, observed); rejected.push('accepted'); }
    catch (error) { rejected.push(error.message); }
  }
  process.stdout.write(JSON.stringify({ ids, classifications, sample, boolean, cli, types, rejected }));
`, pathToFileURL(path.resolve('scripts/participant-filter-precondition-diagnostics.mjs')).href], {
  cwd: process.cwd(), encoding: 'utf8',
}));

describe('participant-filter migration precondition diagnostics', () => {
  it('assigns every precondition a distinct bounded classification', () => {
    expect(diagnostics.ids).toHaveLength(21);
    expect(new Set(diagnostics.classifications).size).toBe(diagnostics.ids.length);
    for (const [index, id] of diagnostics.ids.entries()) {
      expect(diagnostics.classifications[index]).toBe(`check=${id}`);
      expect(validator).toMatch(new RegExp(`(?:beginPrecondition|checkPrecondition)\\('${id}'`));
    }
  });

  it('allows only fixed boolean and count observations', () => {
    expect(diagnostics.sample).toBe('check=database-rooms-empty room_count=2');
    expect(diagnostics.boolean).toBe('check=container-project-match container_project_match=false');
    expect(diagnostics.cli).toBe('check=project-local-cli cli_resolves=false');
    expect(diagnostics.types).toBe('check=generated-types-readable types_readable=false');
    expect(diagnostics.rejected).toEqual([
      'PARTICIPANT_FILTER_DIAGNOSTIC_REJECTED',
      'PARTICIPANT_FILTER_DIAGNOSTIC_REJECTED',
      'PARTICIPANT_FILTER_DIAGNOSTIC_REJECTED',
    ]);
  });

  it('does not forward command output or generic-only precondition receipts', () => {
    expect(validator).toContain('classifyParticipantFilterPrecondition(failedPrecondition,safeObserved)');
    expect(validator).toContain("if(stage==='preconditions')");
    expect(validator).toContain('receipt(`stage=${stage} result=FAIL`)');
    expect(validator).toContain("child.stderr.resume()");
    expect(validator).toContain("backend_type='client backend' and state<>'idle'");
  });
});
