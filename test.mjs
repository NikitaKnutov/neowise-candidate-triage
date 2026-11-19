import assert from "node:assert/strict";
import { once } from "node:events";
import { after, test } from "node:test";

process.env.PORT = "0";
const { server } = await import("./server.mjs");
await once(server, "listening");
const endpoint = `http://127.0.0.1:${server.address().port}/api/triage`;

after(() => new Promise((resolve) => server.close(resolve)));

async function post(body) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test("invalid input returns HTTP 400", async () => {
  for (const body of ["{", "{}", '{"text":"  "}', '{"text":42}']) {
    assert.deepEqual(await post(body), { status: 400, body: { status: "invalid_input" } });
  }
});

test("model failures require manual review", async () => {
  for (const marker of ["[timeout]", "[error]", "[bad-json]", "[bad-topic]", "[empty-draft]"]) {
    assert.deepEqual(await post({ text: marker }), {
      status: 200,
      body: { status: "manual_review", topic: null, draft: null },
    });
  }
});

test("valid model response returns topic and draft", async () => {
  const result = await post({ text: "Когда будет доставка?" });
  assert.equal(result.status, 200);
  assert.equal(result.body.status, "ready");
  assert.equal(result.body.topic, "delivery");
  assert.equal(typeof result.body.draft, "string");
  assert.ok(result.body.draft.trim());
});
