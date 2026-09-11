import type { Database } from '../types/database.generated';

type GeneratedResult = Database['public']['Functions']['resolve_common_filters']['Returns'][number];
export type ResolutionStatus = Database['public']['Enums']['filter_resolution_status'];
export type ResolutionResult =
  | { outcome: 'not_found'; filter_resolution_status: null }
  | { outcome: 'pending'; filter_resolution_status: 'pending' }
  | { outcome: 'compatible'; filter_resolution_status: 'compatible' }
  | { outcome: 'incompatible'; filter_resolution_status: 'incompatible' };

const fields = ['outcome', 'filter_resolution_status'] as const satisfies readonly (keyof GeneratedResult)[];

export class ResolutionContractError extends Error {
  constructor() {
    super('Unable to read common-filter status. Please try again.');
    this.name = 'ResolutionContractError';
  }
}

export function narrowResolutionResult(data: unknown): ResolutionResult {
  if (!Array.isArray(data) || data.length !== 1) throw new ResolutionContractError();
  const row: unknown = data[0];
  if (!row || typeof row !== 'object' || Array.isArray(row) ||
      Object.keys(row).length !== fields.length || !fields.every(field => Object.hasOwn(row, field))) {
    throw new ResolutionContractError();
  }
  const value = row as Record<(typeof fields)[number], unknown>;
  if (!(value.outcome === 'not_found' && value.filter_resolution_status === null ||
      value.outcome === 'pending' && value.filter_resolution_status === 'pending' ||
      value.outcome === 'compatible' && value.filter_resolution_status === 'compatible' ||
      value.outcome === 'incompatible' && value.filter_resolution_status === 'incompatible')) {
    throw new ResolutionContractError();
  }
  return value as ResolutionResult;
}

