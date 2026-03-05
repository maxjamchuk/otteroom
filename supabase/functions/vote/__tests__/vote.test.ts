import { assertEquals } from "https://deno.land/std@0.204.0/testing/asserts.ts";
// Basic check that handler exists

deno.test("vote handler is defined", () => {
  const handler = (await import("../index.ts")).handler;
  assert(handler instanceof Function);
});
