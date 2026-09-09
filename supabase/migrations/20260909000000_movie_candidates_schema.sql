-- Install fixed local metadata and its denied client surface atomically.
begin;

create table public.movie_candidates (
  id text not null,
  title text not null,
  release_year smallint not null,
  poster_key text not null,
  sort_order integer not null,

  constraint movie_candidates_pkey primary key (id),
  constraint movie_candidates_id_format_check
    check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint movie_candidates_title_check
    check (title = pg_catalog.btrim(title) and pg_catalog.length(pg_catalog.btrim(title)) > 0),
  constraint movie_candidates_release_year_check
    check (release_year between 1888 and 9999),
  constraint movie_candidates_poster_key_format_check
    check (poster_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint movie_candidates_poster_key_key unique (poster_key),
  constraint movie_candidates_sort_order_check check (sort_order > 0),
  constraint movie_candidates_sort_order_key unique (sort_order)
);

alter table public.movie_candidates owner to postgres;
revoke all privileges on table public.movie_candidates from public, anon, authenticated;
alter table public.movie_candidates enable row level security;
-- No catalog policies or client column grants. Metadata access starts with the
-- separately reviewed candidate RPC in Phase 3, not a direct catalog read.

insert into public.movie_candidates (id, title, release_year, poster_key, sort_order) values
  ('fixture-cardboard-comet', 'The Cardboard Comet', 2020, 'cardboard-comet', 10),
  ('fixture-pebble-bay-lanterns', 'Lanterns of Pebble Bay', 2021, 'pebble-bay-lanterns', 20),
  ('fixture-cloud-tram-four', 'Cloud Tram Number Four', 2022, 'cloud-tram-four', 30),
  ('fixture-clockwork-orchard', 'The Clockwork Orchard', 2023, 'clockwork-orchard', 40);

-- Appending a nullable field preserves existing Waiting and Ready rows with
-- NULL assignment. Keep generated state, membership, timestamps and grants.
alter table public.rooms
  add column movie_candidate_id text,
  add constraint rooms_movie_candidate_id_fkey foreign key (movie_candidate_id)
    references public.movie_candidates (id) on update no action on delete restrict,
  add constraint rooms_candidate_requires_guest_check
    check (movie_candidate_id is null or guest_user_id is not null);

-- Existing authenticated SELECT(id, code, state) excludes the new column.
-- Preserve rooms RLS and the rooms-only publication without broader grants.
commit;
