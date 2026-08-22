// sync (native fetch) tests — run with: npm test  (node --test)
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Model, sync } from "../dist/app.js";

function fakeResponse(body, { ok = true, status = 200, json = true } = {}) {
	return {
		ok, status, statusText: ok ? "OK" : "Error",
		headers: { get: (h) => (h.toLowerCase() === "content-type" ? (json ? "application/json" : "text/plain") : null) },
		json: async () => body,
		text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
	};
}

let origFetch;
beforeEach(() => { origFetch = global.fetch; });
afterEach(() => { global.fetch = origFetch; });

test("sync read fetches and returns parsed JSON", async () => {
	global.fetch = async () => fakeResponse({ id: 1, name: "X" });
	const m = new Model(); m.url = "/api/thing";
	assert.deepEqual(await sync("read", m, {}), { id: 1, name: "X" });
});

test("Model.fetch() sets attributes from the response", async () => {
	global.fetch = async () => fakeResponse({ id: 7, title: "Hi" });
	const m = new Model({ id: 7 }); m.url = "/api/thing/7";
	await m.fetch();
	assert.equal(m.get("title"), "Hi");
});

test("sync rejects on non-2xx and fires the error callback", async () => {
	global.fetch = async () => fakeResponse({ error: "nope" }, { ok: false, status: 500 });
	const m = new Model(); m.url = "/x";
	let errFired = false;
	await assert.rejects(() => sync("read", m, { error: () => { errFired = true; } }));
	assert.equal(errFired, true);
});

test("sync write sends a JSON body with the right method/headers", async () => {
	let sent;
	global.fetch = async (url, opts) => { sent = opts; return fakeResponse({ ok: true }); };
	const m = new Model({ name: "A" }); m.url = "/x";
	await sync("create", m, {});
	assert.equal(sent.method, "POST");
	assert.equal(sent.headers["Content-Type"], "application/json");
	assert.deepEqual(JSON.parse(sent.body), { name: "A" });
});

test("sync applies custom headers (regression: _.extend must mutate)", async () => {
	let sent;
	global.fetch = async (url, opts) => { sent = opts; return fakeResponse({}); };
	const m = new Model(); m.url = "/x";
	await sync("read", m, { headers: { "X-Test": "1" } });
	assert.equal(sent.headers["X-Test"], "1");
});
