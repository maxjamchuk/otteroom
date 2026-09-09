import type { ImageSourcePropType } from 'react-native';
import { candidateFailureMessage } from './contracts';

export const posterSources = Object.freeze({
  'cardboard-comet': require('../../assets/candidates/cardboard-comet.png') as ImageSourcePropType,
  'pebble-bay-lanterns': require('../../assets/candidates/pebble-bay-lanterns.png') as ImageSourcePropType,
  'cloud-tram-four': require('../../assets/candidates/cloud-tram-four.png') as ImageSourcePropType,
  'clockwork-orchard': require('../../assets/candidates/clockwork-orchard.png') as ImageSourcePropType,
});

export class CandidatePosterError extends Error {
  constructor() { super(candidateFailureMessage); this.name = 'CandidatePosterError'; }
}

export function resolveCandidatePoster(key: string): ImageSourcePropType {
  if (!Object.hasOwn(posterSources, key)) throw new CandidatePosterError();
  return posterSources[key as keyof typeof posterSources];
}
