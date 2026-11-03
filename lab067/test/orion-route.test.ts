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

test("route: cross-origin POST is refused before any configuration or model call", async () => {
  const { POST } = await import("../app/api/orion/route.ts");
  const r = await POST(new Request("http://localhost:3000/api/orion", {
    method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example", host: "localhost:3000" },
    body: JSON.stringify({ kind: "scientific-question", text: "q" }),
  }));
  assert.equal(r.status, 403);
});

test("route: rate limit returns 429 with Retry-After (model call stubbed via unreachable https host)", async () => {
  process.env.ORION_API_KEY = "nvapi-RATELIMITTEST_abcdefghijklmnop";
  process.env.ORION_BASE_URL = "https://127.0.0.1:9/v1"; // closed port: each allowed call fails fast as "network"
  process.env.ORION_TIMEOUT_MS = "2000";
  const { POST } = await import("../app/api/orion/route.ts");
  const mk = () => new Request("http://localhost/api/orion", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" }, body: JSON.stringify({ kind: "scientific-question", text: "q" }) });
  const statuses: number[] = [];
  for (let i = 0; i < 11; i++) statuses.push((await POST(mk())).status);
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(502), "allowed calls reach the (failing) upstream");
  const last = await POST(mk());
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get("retry-after")) > 0);
  delete process.env.ORION_API_KEY; delete process.env.ORION_BASE_URL; delete process.env.ORION_TIMEOUT_MS;
});
