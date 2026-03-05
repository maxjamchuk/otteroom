import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateRoomCode(): Promise<string> {
  // Generate a short 6-character alphanumeric code
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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
    let language = body.language || "en";
    const region = body.region || null;

    // Normalize language to supported languages, fallback to EN
    const supportedLanguages = ["ru", "en", "de", "fr", "es", "pt", "tr", "pl", "it"];
    if (!supportedLanguages.includes(language.toLowerCase())) {
      language = "en";
    }

    // Generate unique room code
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = await generateRoomCode();
      const { data: existing } = await supabase
        .from("rooms")
        .select("id")
        .eq("code", code)
        .single();

      if (!existing) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new Error("Failed to generate unique room code");
    }

    // Create room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({
        code,
        created_by: user.id,
        language: language.toLowerCase(),
        region,
        status: "lobby",
        max_members: 2,
        current_idx: 0,
      })
      .select()
      .single();

    if (roomError) throw roomError;

    // Add creator as host
    const { error: memberError } = await supabase
      .from("room_members")
      .insert({
        room_id: room.id,
        user_id: user.id,
        role: "host",
      });

    if (memberError) throw memberError;

    return new Response(
      JSON.stringify({
        room_id: room.id,
        code: room.code,
        language: room.language,
        region: room.region,
        status: room.status,
        max_members: room.max_members,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in create-room:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

Deno.serve(handler);
