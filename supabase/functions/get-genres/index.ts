import { createTMDBClient } from "../_shared/tmdb.ts";

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
    const tmdbToken = Deno.env.get("TMDB_API_TOKEN");

    if (!tmdbToken) {
      throw new Error("Missing TMDB_API_TOKEN");
    }

    // Parse query params
    const url = new URL(req.url);
    const language = url.searchParams.get("language") || "en";

    const tmdb = createTMDBClient(tmdbToken);
    const genres = await tmdb.getGenres(language);

    return new Response(
      JSON.stringify({ genres }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in get-genres:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

Deno.serve(handler);
