import { test } from "node:test";
import assert from "node:assert/strict";
import { clientId, createRateLimiter, readRateLimit, sameOriginViolation } from "../src/orion/model/guard.ts";

test("rate limiter: allows `limit` per window per client, then refuses until the window resets", () => {
  let t = 0;
  const rl = createRateLimiter(3, 60_000, () => t);
  assert.deepEqual([1, 2, 3].map(() => rl.check("a").allowed), [true, true, true]);
  const blocked = rl.check("a");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 60_000);
  assert.equal(rl.check("b").allowed, true, "clients are independent");
  t = 60_000;
  assert.equal(rl.check("a").allowed, true, "window reset");
});

test("rate limit config is bounded", () => {
  assert.equal(readRateLimit({}), 10);
  assert.equal(readRateLimit({ ORION_RATE_LIMIT_PER_MIN: "30" }), 30);
  for (const bad of ["0", "-1", "1.5", "abc", "100000"]) assert.equal(readRateLimit({ ORION_RATE_LIMIT_PER_MIN: bad }), 10);
});

test("same-origin: refuses foreign Origin, allows same host and no Origin", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  assert.equal(sameOriginViolation(h({ host: "localhost:3000", origin: "http://localhost:3000" }), "http://localhost:3000/api/orion"), null);
  assert.equal(sameOriginViolation(h({ host: "localhost:3000" }), "http://localhost:3000/api/orion"), null);
  assert.match(sameOriginViolation(h({ host: "localhost:3000", origin: "https://evil.example" }), "http://localhost:3000/api/orion") ?? "", /evil\.example/);
  assert.ok(sameOriginViolation(h({ host: "localhost:3000", origin: "not a url" }), "http://localhost:3000/api/orion"));
});

test("client id prefers first forwarded address", () => {
  assert.equal(clientId(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })), "1.2.3.4");
  assert.equal(clientId(new Headers()), "local");
});
