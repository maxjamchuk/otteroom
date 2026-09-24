export type ControlledCandidateFixture = Readonly<{
  fixtureClass: 'constellation' | 'aurora';
  tmdbMovieId: number;
  title: string;
  releaseYear: number;
  posterPath: string;
  discover: Readonly<{
    id: number;
    adult: false;
    genre_ids: readonly [18, 28];
    title: string;
    release_date: string;
    poster_path: string;
    vote_count: number;
    vote_average: number;
    popularity: number;
  }>;
}>;

function fixture(fixtureClass: ControlledCandidateFixture['fixtureClass'], tmdbMovieId: number,
  title: string, releaseDate: string, posterPath: string, voteCount: number,
  voteAverage: number, popularity: number): ControlledCandidateFixture {
  return Object.freeze({ fixtureClass, tmdbMovieId, title,
    releaseYear: Number(releaseDate.slice(0, 4)), posterPath,
    discover: Object.freeze({ id: tmdbMovieId, adult: false as const,
      genre_ids: Object.freeze([18, 28]) as readonly [18, 28], title,
      release_date: releaseDate, poster_path: posterPath,
      vote_count: voteCount, vote_average: voteAverage, popularity }) });
}

export const controlledCandidate = fixture('constellation', 6006,
  'Controlled Constellation', '2005-06-07', '/controlled.png', 900, 8.2, 91.4);
export const controlledSuccessor = fixture('aurora', 6007,
  'Controlled Aurora', '2006-07-08', '/controlled-successor.png', 700, 7.8, 84.2);

export const controlledDecoys = Object.freeze([
  Object.freeze({ ...controlledCandidate.discover, id: 6001, adult: true }),
  Object.freeze({ ...controlledCandidate.discover, id: 6002, genre_ids: Object.freeze([28]) }),
  Object.freeze({ ...controlledCandidate.discover, id: 6003, release_date: '1888-01-01' }),
]);

export const controlledDiscoverResults = Object.freeze([
  ...controlledDecoys, controlledCandidate.discover, controlledSuccessor.discover,
]);

export function controlledFixtureById(tmdbMovieId: number): ControlledCandidateFixture | null {
  return tmdbMovieId === controlledCandidate.tmdbMovieId ? controlledCandidate :
    tmdbMovieId === controlledSuccessor.tmdbMovieId ? controlledSuccessor : null;
}
