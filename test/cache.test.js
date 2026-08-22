// Offline cache tests — run with: npm test  (node --test)
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Model } from "../dist/app.js";

function mockStorage() {
	const s = {};
	return {
		getItem: (k) => (k in s ? s[k] : null),
		setItem: (k, v) => { s[k] = String(v); },
		removeItem: (k) => { delete s[k]; },
		_s: s,
	};
}

let origLS, origFetch;
beforeEach(() => { origLS = global.localStorage; origFetch = global.fetch; global.localStorage = mockStorage(); });
afterEach(() => { global.localStorage = origLS; global.fetch = origFetch; });

test("Model.cache round-trips through localStorage and honours cache_exclude", () => {
	const m = new Model({ id: 3 }, { cache: true, cacheOptions: { cache_exclude: ["secret"] } });
	m.cache({ id: 3, name: "Zed", secret: "x" });
	const got = m.cache();
	assert.equal(got.name, "Zed");
	assert.equal(got.id, 3);
	assert.equal("secret" in got, false);
});

test("sync read falls back to the cache when the network fails", async () => {
	const m = new Model({ id: 9 }, { cache: true });
	m.url = "/api/x/9";
	m.cache({ id: 9, name: "Cached" });   // seed
	global.fetch = async () => { throw new Error("offline"); };
	const data = await m.fetch();          // resolves from cache via the success path
	assert.equal(m.get("name"), "Cached");
	assert.equal(data.name, "Cached");
});

test("Model.cache() returns false when nothing is stored", () => {
	const m = new Model({ id: 42 }, { cache: true });
	assert.equal(m.cache(), false);
});

test("cache_timestamp wraps the payload but round-trips the data", () => {
	const m = new Model({ id: 5 }, { cache: true, cacheOptions: { cache_timestamp: true } });
	m.cache({ id: 5, name: "Stamped" });
	// stored form is the timestamped envelope...
	const raw = JSON.parse(global.localStorage.getItem("model_5"));
	assert.ok(raw.timestamp && raw.data);
	// ...but reading it back yields the original data
	assert.equal(m.cache().name, "Stamped");
});
