import { PARTICIPANT_GENRES, PARTICIPANT_GENRE_VALUES, labelForGenre } from '../../src/filters/genres';

const expected = [
  ['action','Action'],['adventure','Adventure'],['animation','Animation'],['comedy','Comedy'],
  ['crime','Crime'],['documentary','Documentary'],['drama','Drama'],['family','Family'],
  ['fantasy','Fantasy'],['history','History'],['horror','Horror'],['music','Music'],
  ['mystery','Mystery'],['romance','Romance'],['science_fiction','Science Fiction'],
  ['tv_movie','TV Movie'],['thriller','Thriller'],['war','War'],['western','Western'],
] as const;

it('exports the exact readonly 19-value canonical vocabulary and labels', () => {
  expect(PARTICIPANT_GENRES.map(({ value,label })=>[value,label])).toEqual(expected);
  expect(PARTICIPANT_GENRE_VALUES).toEqual(expected.map(([value])=>value));
  for (const [value,label] of expected) expect(labelForGenre(value)).toBe(label);
  expect(Object.isFrozen(PARTICIPANT_GENRES)).toBe(true);
  expect(Object.isFrozen(PARTICIPANT_GENRE_VALUES)).toBe(true);
});

it('keeps empty selection as Any rather than expanding it to all values', () => {
  const selected: readonly string[]=[];
  expect(selected).toHaveLength(0);
  expect(selected).not.toEqual(PARTICIPANT_GENRE_VALUES);
});
