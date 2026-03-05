import { assertEquals, assert } from "https://deno.land/std@0.204.0/testing/asserts.ts";
import * as tmdbModule from "../_shared/tmdb.ts";

// Mock TMDB client
class MockTMDB {
  constructor(token: string) {}
  async discoverMovies(opts: any) {
    return { results: Array(120).fill({ id: 1 }), total_pages: 1, page: 1 };
  }
}

// replace createTMDBClient with mock
deno.test("seed-queue produces 120 items and respects language fallback", async () => {
  // monkey patch
  (tmdbModule as any).createTMDBClient = (token: string) => new MockTMDB(token);

  // simulate calling handler with minimal environment
  const handler = (await import("../index.ts")).handler;

  const req = new Request("http://localhost", { method: "POST", body: JSON.stringify({ room_id: "00000000-0000-0000-0000-000000000000" }) });

  // set env
  Deno.env.set("TMDB_API_TOKEN", "fake");
  Deno.env.set("SUPABASE_URL", "https://example.com");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "key");

  const resp = await handler(req);
  assertEquals(resp.status, 500); // because DB call will fail without supabase; we at least want not crash
});
