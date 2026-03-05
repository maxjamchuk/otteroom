import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { createTMDBClient } from "../_shared/tmdb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TARGET_QUEUE_SIZE = 120;
const MIN_QUEUE_SIZE = 30;
const VOTE_COUNT_THRESHOLDS = [200, 100, 50, 25];

async function handler(req: Request): Promise<Response> {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const tmdbToken = Deno.env.get("TMDB_API_TOKEN");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    if (!tmdbToken) {
      throw new Error("Missing TMDB_API_TOKEN");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body = await req.json();
    const { room_id } = body;

    if (!room_id) {
      return new Response(
        JSON.stringify({ error: "Missing room_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get room and members
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", room_id)
      .single();

    if (roomError || !room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: members, error: membersError } = await supabase
      .from("room_members")
      .select("*")
      .eq("room_id", room_id);

    if (membersError || !members || members.length === 0) {
      throw new Error("Failed to fetch room members");
    }

    // Collect all preferences
    const allGenres = new Set<number>();
    for (const member of members) {
      if (member.preferences?.genres && Array.isArray(member.preferences.genres)) {
        member.preferences.genres.forEach((g: number) => allGenres.add(g));
      }
    }

    // Get intersection of genres (prefer common ones first)
    const firstMemberGenres = new Set(members[0].preferences?.genres || []);
    const intersectionGenres = Array.from(allGenres).filter(
      (g) =>
        members.every(
          (m) => m.preferences?.genres && Array.isArray(m.preferences.genres) && m.preferences.genres.includes(g)
        )
    );

    // Get watched/hidden movies for exclusion
    const { data: watchedMovies } = await supabase
      .from("watched_movies")
      .select("movie_id")
      .in("user_id", members.map((m) => m.user_id));

    const excludedMovieIds = new Set(watchedMovies?.map((w) => w.movie_id) || []);

    // Seed movies
    const tmdb = createTMDBClient(tmdbToken);
    const candidates: number[] = [];
    let genresToUse = intersectionGenres.length > 0 ? intersectionGenres : Array.from(allGenres);

    // Try different vote count thresholds
    for (const voteThreshold of VOTE_COUNT_THRESHOLDS) {
      if (candidates.length >= TARGET_QUEUE_SIZE) break;

      const genreString = genresToUse.join(",");

      try {
        for (let page = 1; page <= 5; page++) {
          if (candidates.length >= TARGET_QUEUE_SIZE) break;

          const result = await tmdb.discoverMovies({
            language: room.language || "en",
            region: room.region,
            with_genres: genreString,
            include_adult: false,
            vote_count_gte: voteThreshold,
            sort_by: "popularity.desc",
            page,
          });

          for (const movie of result.results) {
            if (candidates.length >= TARGET_QUEUE_SIZE) break;
            if (!excludedMovieIds.has(movie.id) && !candidates.includes(movie.id)) {
              candidates.push(movie.id);
            }
          }

          if (result.page >= result.total_pages) break;
        }
      } catch (error) {
        console.error(`Error fetching movies with vote_count_gte=${voteThreshold}:`, error);
      }

      // Relax to union if we don't have enough with intersection
      if (candidates.length < TARGET_QUEUE_SIZE && genresToUse === intersectionGenres && Array.from(allGenres).length > intersectionGenres.length) {
        genresToUse = Array.from(allGenres);
      }
    }

    // Validate we have minimum
    if (candidates.length < MIN_QUEUE_SIZE) {
      throw new Error(`Could not fetch minimum ${MIN_QUEUE_SIZE} movies. Try fewer genres or broaden filters.`);
    }

    // Insert movies into room_movies
    const moviesToInsert = candidates.slice(0, TARGET_QUEUE_SIZE).map((movieId, idx) => ({
      room_id,
      movie_id: movieId,
      idx,
    }));

    const { error: insertError } = await supabase.from("room_movies").insert(moviesToInsert);

    if (insertError) throw insertError;

    // Update room status and current movie
    const firstMovieId = candidates[0];
    const { data: updatedRoom, error: updateError } = await supabase
      .from("rooms")
      .update({
        status: "voting",
        current_idx: 0,
        current_movie_id: firstMovieId,
      })
      .eq("id", room_id)
      .select()
      .single();

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        room_id: updatedRoom.id,
        status: updatedRoom.status,
        current_idx: updatedRoom.current_idx,
        current_movie_id: updatedRoom.current_movie_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in seed-queue:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

Deno.serve(handler);
