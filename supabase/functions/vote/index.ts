import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function handler(req: Request): Promise<Response> {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { room_id, movie_id, vote: voteValue } = body;

    if (!room_id || movie_id === undefined || voteValue === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing room_id, movie_id, or vote" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (voteValue !== 1 && voteValue !== -1) {
      return new Response(
        JSON.stringify({ error: "Vote must be 1 (like) or -1 (dislike)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get room
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

    // Check if user is member
    const { data: membership } = await supabase
      .from("room_members")
      .select("*")
      .eq("room_id", room_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Not a member of this room" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert vote
    const { error: voteError } = await supabase.from("votes").upsert(
      {
        room_id,
        movie_id,
        user_id: user.id,
        vote: voteValue,
      },
      { onConflict: "room_id,movie_id,user_id" }
    );

    if (voteError) throw voteError;

    // Get all members to check if both have voted
    const { data: members, error: membersError } = await supabase
      .from("room_members")
      .select("*")
      .eq("room_id", room_id);

    if (membersError || !members || members.length === 0) {
      throw new Error("Failed to fetch room members");
    }

    // Get all votes for current movie
    const { data: votes, error: votesError } = await supabase
      .from("votes")
      .select("*")
      .eq("room_id", room_id)
      .eq("movie_id", movie_id);

    if (votesError) throw votesError;

    // Check if all members have voted
    const userIds = new Set(members.map((m) => m.user_id));
    const votedUsers = new Set(votes?.map((v) => v.user_id) || []);
    const allVoted = userIds.size === votedUsers.size && Array.from(userIds).every((u) => votedUsers.has(u));

    let updatedRoom = room;

    if (allVoted) {
      // Count likes and dislikes
      const likes = votes!.filter((v) => v.vote === 1).length;
      const dislikes = votes!.filter((v) => v.vote === -1).length;

      // Check if already matched
      const { data: existingMatch } = await supabase
        .from("matches")
        .select("*")
        .eq("room_id", room_id)
        .maybeSingle();

      if (existingMatch) {
        // Already matched, return current state
        const { data: currentRoom } = await supabase
          .from("rooms")
          .select("*")
          .eq("id", room_id)
          .single();

        return new Response(
          JSON.stringify({
            room_id: currentRoom.id,
            status: currentRoom.status,
            current_idx: currentRoom.current_idx,
            current_movie_id: currentRoom.current_movie_id,
            match: existingMatch,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Both like -> create match
      if (likes === members.length) {
        const { error: matchError } = await supabase.from("matches").insert({
          room_id,
          movie_id,
        });

        if (matchError) throw matchError;

        const { data: match } = await supabase
          .from("matches")
          .select("*")
          .eq("room_id", room_id)
          .single();

        const { data: updatedRoomData } = await supabase
          .from("rooms")
          .update({
            status: "matched",
          })
          .eq("id", room_id)
          .select()
          .single();

        updatedRoom = updatedRoomData;

        return new Response(
          JSON.stringify({
            room_id: updatedRoom.id,
            status: updatedRoom.status,
            current_idx: updatedRoom.current_idx,
            current_movie_id: updatedRoom.current_movie_id,
            match,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Any dislike -> advance to next movie
      if (dislikes > 0) {
        const nextIdx = room.current_idx + 1;

        // Get next movie
        const { data: nextMovie } = await supabase
          .from("room_movies")
          .select("movie_id")
          .eq("room_id", room_id)
          .eq("idx", nextIdx)
          .single();

        let nextStatus = "voting";
        let nextMovieId = nextMovie?.movie_id || null;

        // Check if no more movies
        if (!nextMovie) {
          nextStatus = "closed";
        }

        const { data: updatedRoomData } = await supabase
          .from("rooms")
          .update({
            status: nextStatus,
            current_idx: nextIdx,
            current_movie_id: nextMovieId,
          })
          .eq("id", room_id)
          .select()
          .single();

        updatedRoom = updatedRoomData;
      }
    }

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
    console.error("Error in vote:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

Deno.serve(handler);
