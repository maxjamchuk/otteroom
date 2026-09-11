import type { Database } from '../types/database.generated';

export type ParticipantGenre = Database['public']['Enums']['participant_genre'];

export const PARTICIPANT_GENRES = Object.freeze([
  { value:'action',label:'Action' },{ value:'adventure',label:'Adventure' },
  { value:'animation',label:'Animation' },{ value:'comedy',label:'Comedy' },
  { value:'crime',label:'Crime' },{ value:'documentary',label:'Documentary' },
  { value:'drama',label:'Drama' },{ value:'family',label:'Family' },
  { value:'fantasy',label:'Fantasy' },{ value:'history',label:'History' },
  { value:'horror',label:'Horror' },{ value:'music',label:'Music' },
  { value:'mystery',label:'Mystery' },{ value:'romance',label:'Romance' },
  { value:'science_fiction',label:'Science Fiction' },{ value:'tv_movie',label:'TV Movie' },
  { value:'thriller',label:'Thriller' },{ value:'war',label:'War' },
  { value:'western',label:'Western' },
] as const satisfies readonly { value:ParticipantGenre;label:string }[]);

export const PARTICIPANT_GENRE_VALUES: readonly ParticipantGenre[] = Object.freeze(
  PARTICIPANT_GENRES.map(({ value }) => value),
);
const labels = new Map(PARTICIPANT_GENRES.map(item=>[item.value,item.label]));
export function labelForGenre(value:ParticipantGenre):string { return labels.get(value)!; }
export function isParticipantGenre(value:unknown):value is ParticipantGenre {
  return typeof value==='string' && (PARTICIPANT_GENRE_VALUES as readonly string[]).includes(value);
}
export function canonicalGenres(values:readonly ParticipantGenre[]):ParticipantGenre[] {
  const selected=new Set(values);
  return PARTICIPANT_GENRE_VALUES.filter(value=>selected.has(value));
}
