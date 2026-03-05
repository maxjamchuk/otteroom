-- 001_create_core_tables.sql
-- Otteroom MVP database schema
-- Tables: rooms, room_members, room_movies, votes, matches, watched_movies

-- Create extension for UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'voting', 'matched', 'closed')),
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  language text NOT NULL DEFAULT 'en',
  region text,
  max_members integer DEFAULT 2,
  current_idx integer DEFAULT 0,
  current_movie_id integer,
  settings jsonb
);

CREATE TABLE IF NOT EXISTS room_members (
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('host', 'member', 'display')),
  joined_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  preferences jsonb,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS room_movies (
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  movie_id integer NOT NULL,
  idx integer NOT NULL,
  PRIMARY KEY (room_id, movie_id),
  UNIQUE (room_id, idx)
);

CREATE TABLE IF NOT EXISTS votes (
  room_id uuid NOT NULL,
  movie_id integer NOT NULL,
  user_id uuid NOT NULL,
  vote smallint NOT NULL CHECK (vote IN (-1, 1)),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (room_id, movie_id, user_id)
);

CREATE TABLE IF NOT EXISTS matches (
  room_id uuid NOT NULL PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  movie_id integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watched_movies (
  user_id uuid NOT NULL,
  movie_id integer NOT NULL,
  status text NOT NULL DEFAULT 'watched' CHECK (status IN ('watched', 'hidden')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, movie_id)
);

-- Create indexes for performance
CREATE INDEX idx_room_members_room_id ON room_members(room_id);
CREATE INDEX idx_room_members_user_id ON room_members(user_id);
CREATE INDEX idx_room_movies_room_id_idx ON room_movies(room_id, idx);
CREATE INDEX idx_votes_room_id_movie_id ON votes(room_id, movie_id);
CREATE INDEX idx_watched_movies_user_id ON watched_movies(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE watched_movies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rooms: members can read their room
CREATE POLICY rooms_select_members ON rooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = rooms.id
        AND room_members.user_id = auth.uid()
    )
  );

-- RLS Policies for room_members: members can read their room's members
CREATE POLICY room_members_select ON room_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members rm
      WHERE rm.room_id = room_members.room_id
        AND rm.user_id = auth.uid()
    )
  );

-- RLS Policies for room_movies: members can read their room's movies
CREATE POLICY room_movies_select ON room_movies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = room_movies.room_id
        AND room_members.user_id = auth.uid()
    )
  );

-- RLS Policies for votes: members can read their room's votes
CREATE POLICY votes_select ON votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = votes.room_id
        AND room_members.user_id = auth.uid()
    )
  );

-- RLS Policies for matches: members can read their room's match
CREATE POLICY matches_select ON matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = matches.room_id
        AND room_members.user_id = auth.uid()
    )
  );

-- RLS Policies for watched_movies: users can read/write only their own
CREATE POLICY watched_movies_select ON watched_movies FOR SELECT
  USING (watched_movies.user_id = auth.uid());

CREATE POLICY watched_movies_insert ON watched_movies FOR INSERT
  WITH CHECK (watched_movies.user_id = auth.uid());

CREATE POLICY watched_movies_update ON watched_movies FOR UPDATE
  USING (watched_movies.user_id = auth.uid())
  WITH CHECK (watched_movies.user_id = auth.uid());

CREATE POLICY watched_movies_delete ON watched_movies FOR DELETE
  USING (watched_movies.user_id = auth.uid());
