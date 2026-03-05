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
    const { room_id, preferences } = body;

    if (!room_id || !preferences) {
      return new Response(
        JSON.stringify({ error: "Missing room_id or preferences" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate genres (max 5)
    if (preferences.genres && Array.isArray(preferences.genres) && preferences.genres.length > 5) {
      return new Response(
        JSON.stringify({ error: "Maximum 5 genres allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is member of room
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

    // Update preferences for user in room
    const { error: updateError } = await supabase
      .from("room_members")
      .update({ preferences })
      .eq("room_id", room_id)
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    // Get current room state
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", room_id)
      .single();

    if (roomError) throw roomError;

    // Check if both members have set preferences
    const { data: allMembers } = await supabase
      .from("room_members")
      .select("*")
      .eq("room_id", room_id);

    const allHavePreferences = allMembers && allMembers.every((m) => m.preferences);

    if (allHavePreferences && allMembers!.length === room.max_members && room.status === "lobby") {
      // Trigger seed-queue by calling it
      try {
        const seedResponse = await fetch(`${supabaseUrl}/functions/v1/seed-queue`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ room_id }),
        });

        if (!seedResponse.ok) {
          console.error("Failed to seed queue:", await seedResponse.text());
          throw new Error("Failed to seed queue");
        }

        const seededRoom = await seedResponse.json();

        return new Response(
          JSON.stringify({
            room_id: seededRoom.room_id,
            status: seededRoom.status,
            seeded: true,
            current_idx: seededRoom.current_idx,
            current_movie_id: seededRoom.current_movie_id,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        console.error("Error seeding queue:", error);
        // Still return success for preferences update
        return new Response(
          JSON.stringify({
            room_id,
            status: room.status,
            seeded: false,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        room_id,
        status: room.status,
        seeded: false,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in set-preferences:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

Deno.serve(handler);
