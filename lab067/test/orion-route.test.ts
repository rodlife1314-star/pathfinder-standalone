/** Route-level tests that need no network: configuration and request validation. */
import { test } from "node:test";
import assert from "node:assert/strict";

const KEY = "nvapi-ROUTETEST_abcdefghijklmnopqrstuvwxyz";
const post = (body: unknown) => new Request("http://localhost/api/orion", { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });

test("route: no key configured → 503 config error; GET reports unconfigured", async () => {
  delete process.env.ORION_API_KEY;
  const { GET, POST } = await import("../app/api/orion/route.ts");
  const r = await POST(post({ kind: "scientific-question", text: "q" }));
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error.kind, "config");
  assert.equal((await GET().json()).configured, false);
});

test("route: request validation and no key in GET output", async () => {
  process.env.ORION_API_KEY = KEY;
  process.env.ORION_BASE_URL = "https://example.invalid/v1";
  const { GET, POST } = await import("../app/api/orion/route.ts");
  const g = await GET().text();
  assert.ok(!g.includes(KEY) && !g.includes("ROUTETEST"));
  assert.equal((await POST(post("not json"))).status, 400);
  assert.equal((await POST(post({ kind: "declare-validated", text: "x" }))).status, 400);
  assert.equal((await POST(post({ kind: "scientific-question", text: "  " }))).status, 400);
  assert.equal((await POST(post({ kind: "scientific-question", text: "x".repeat(2001) }))).status, 400);
  delete process.env.ORION_API_KEY; delete process.env.ORION_BASE_URL;
});
