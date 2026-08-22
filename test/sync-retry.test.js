// sync retry/backoff tests — run with: npm test  (node --test)
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Model, sync } from "../dist/app.js";

function okJSON(body) {
	return {
		ok: true, status: 200, statusText: "OK",
		headers: { get: (h) => (h.toLowerCase() === "content-type" ? "application/json" : null) },
		json: async () => body,
		text: async () => JSON.stringify(body),
	};
}
function httpError(status) {
	return {
		ok: false, status, statusText: "Error",
		headers: { get: () => "application/json" },
		json: async () => ({}), text: async () => "{}",
	};
}

let origFetch;
beforeEach(() => { origFetch = global.fetch; });
afterEach(() => { global.fetch = origFetch; });

test("retry: a read failing twice with a network error then succeeds", async () => {
	let calls = 0;
	global.fetch = async () => {
		calls++;
		if (calls < 3) throw new TypeError("network down");   // no .status -> transient
		return okJSON({ id: 1, ok: true });
	};
	const m = new Model(); m.url = "/api/thing";
	const data = await sync("read", m, { retry: 3, retryDelay: 1 });
	assert.equal(calls, 3, "retried until the third attempt succeeded");
	assert.deepEqual(data, { id: 1, ok: true });
});

test("retry: an HTTP 4xx is never retried (status is set)", async () => {
	let calls = 0;
	global.fetch = async () => { calls++; return httpError(404); };
	const m = new Model(); m.url = "/x";
	await assert.rejects(() => sync("read", m, { retry: 5, retryDelay: 1 }));
	assert.equal(calls, 1, "a 4xx short-circuits retry");
});

test("retry: unsafe methods (writes) are never retried", async () => {
	let calls = 0;
	global.fetch = async () => { calls++; throw new TypeError("network down"); };
	const m = new Model({ name: "A" }); m.url = "/x";
	await assert.rejects(() => sync("create", m, { retry: 5, retryDelay: 1 }));
	assert.equal(calls, 1, "an unsafe method is not retried");
});

test("retry: gives up after `retry` attempts and rejects", async () => {
	let calls = 0;
	global.fetch = async () => { calls++; throw new TypeError("still down"); };
	const m = new Model(); m.url = "/x";
	await assert.rejects(() => sync("read", m, { retry: 2, retryDelay: 1 }));
	assert.equal(calls, 3, "1 initial attempt + 2 retries");
});

test("retry: the request event fires once regardless of attempts", async () => {
	let calls = 0, requests = 0;
	global.fetch = async () => { calls++; if (calls < 2) throw new TypeError("x"); return okJSON({ ok: 1 }); };
	const m = new Model(); m.url = "/x";
	m.on("request", () => requests++);
	await sync("read", m, { retry: 3, retryDelay: 1 });
	assert.equal(requests, 1, "request fires once, not per attempt");
});
