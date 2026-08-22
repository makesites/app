// sync cancellation/timeout + Collection.save — run with: npm test
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Model, Collection, sync } from "../dist/app.js";

// a fetch that never resolves unless its signal aborts
function abortableFetch(url, opts) {
	return new Promise((resolve, reject) => {
		if (opts.signal) opts.signal.addEventListener("abort", () => {
			const e = new Error("aborted"); e.name = "AbortError"; reject(e);
		});
	});
}

let origFetch;
beforeEach(() => { origFetch = global.fetch; });
afterEach(() => { global.fetch = origFetch; });

test("sync: options.timeout aborts a slow request", async () => {
	global.fetch = abortableFetch;
	const m = new Model(); m.url = "/slow";
	await assert.rejects(() => sync("read", m, { timeout: 20 }), /abort/i);
});

test("sync: options.signal lets the caller abort", async () => {
	global.fetch = abortableFetch;
	const controller = new AbortController();
	const m = new Model(); m.url = "/x";
	const p = sync("read", m, { signal: controller.signal });
	controller.abort();
	await assert.rejects(() => p, /abort/i);
});

test("Collection.save() saves every model (Promise.all)", async () => {
	let calls = 0;
	global.fetch = async () => ({
		ok: true, status: 200, statusText: "OK",
		headers: { get: () => "application/json" },
		json: async () => { calls++; return {}; },
		text: async () => "{}",
	});
	const c = new Collection([{ id: 1 }, { id: 2 }, { id: 3 }]);
	c.data.forEach(m => { m.url = "/api/x"; });
	await c.save();
	assert.equal(calls, 3, "one request per model");
});
