// Shared TMDB client helper for seeding and fetching movies

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  runtime?: number;
  genres?: Array<{ id: number; name: string }>;
}

export interface DiscoverOptions {
  language?: string;
  region?: string;
  with_genres?: string;
  include_adult?: boolean;
  vote_count_gte?: number;
  sort_by?: string;
  page?: number;
}

class TMDBClient {
  private token: string;
  private baseUrl = "https://api.themoviedb.org/3";

  constructor(token: string) {
    this.token = token;
  }

  async getGenres(language: string = "en"): Promise<Array<{ id: number; name: string }>> {
    const url = `${this.baseUrl}/genre/movie/list?api_key=${this.token}&language=${language}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch genres: ${response.status}`);
    }

    const data = await response.json();
    return data.genres || [];
  }

  async discoverMovies(
    options: DiscoverOptions & { api_key?: string } = {}
  ): Promise<{
    results: TMDBMovie[];
    total_pages: number;
    page: number;
  }> {
    const params = new URLSearchParams({
      api_key: this.token,
      language: options.language || "en",
      include_adult: String(options.include_adult === true),
      sort_by: options.sort_by || "popularity.desc",
      page: String(options.page || 1),
    });

    if (options.region) {
      params.append("region", options.region);
    }

    if (options.with_genres) {
      params.append("with_genres", options.with_genres);
    }

    if (options.vote_count_gte) {
      params.append("vote_count.gte", String(options.vote_count_gte));
    }

    const url = `${this.baseUrl}/discover/movie?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to discover movies: ${response.status}`);
    }

    const data = await response.json();
    return {
      results: data.results || [],
      total_pages: data.total_pages || 0,
      page: data.page || 1,
    };
  }

  async getMovieDetails(movieId: number, language: string = "en"): Promise<TMDBMovie> {
    const url = `${this.baseUrl}/movie/${movieId}?api_key=${this.token}&language=${language}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch movie details: ${response.status}`);
    }

    return await response.json();
  }
}

export function createTMDBClient(token: string): TMDBClient {
  return new TMDBClient(token);
}
