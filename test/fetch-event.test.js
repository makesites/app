// The "fetch" event — run with: npm test
//
// It used to be emitted from parse() on a 200ms setTimeout: a side effect, on a
// timer, inside a transform. Listeners raced the data they were being told
// about, and save() emitted it too.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Model, Collection } from "../dist/app.js";

afterEach(() => { delete globalThis.fetch; });

const respond = ( body ) => {
	globalThis.fetch = async () => ({
		ok: true,
		status: 200,
		statusText: "OK",
		headers: { get: () => "application/json" },
		json: async () => body
	});
};

test("Model: 'fetch' fires once the response has been applied", async () => {
	respond({ id: 1, title: "Middlemarch" });
	const model = new Model({ id: 1 }, {});
	model.urlRoot = "/api/books";

	let titleWhenHeard = null;
	model.on("fetch", () => { titleWhenHeard = model.get("title"); });

	await model.fetch();
	// regression: the event fired 200ms LATER, so a listener could not rely on
	// anything about ordering — and by then the caller had long moved on
	assert.equal(titleWhenHeard, "Middlemarch", "the data is already set when it fires");
});

test("Model: 'fetch' has fired by the time the promise resolves", async () => {
	respond({ id: 1, title: "x" });
	const model = new Model({ id: 1 }, {});
	model.urlRoot = "/api/books";

	let fired = false;
	model.on("fetch", () => { fired = true; });
	await model.fetch();
	assert.equal(fired, true, "synchronous, not deferred");
});

test("Model: 'sync' precedes 'fetch'", async () => {
	respond({ id: 1 });
	const model = new Model({ id: 1 }, {});
	model.urlRoot = "/api/books";

	const order = [];
	model.on("sync", () => order.push("sync"));
	model.on("fetch", () => order.push("fetch"));
	await model.fetch();
	assert.deepEqual(order, ["sync", "fetch"]);
});

test("save() does NOT emit 'fetch'", async () => {
	respond({ id: 1, title: "saved" });
	const model = new Model({ id: 1, title: "t" }, {});
	model.urlRoot = "/api/books";

	let fired = false;
	model.on("fetch", () => { fired = true; });
	await model.save();
	// regression: save() runs parse() on the response, and parse() used to be
	// what scheduled the event — so every save announced a fetch
	assert.equal(fired, false);
});

test("parse() on its own emits nothing, now or later", async () => {
	const model = new Model();
	let fired = false;
	model.on("fetch", () => { fired = true; });

	model.parse({ a: 1 });
	assert.equal(fired, false, "not synchronously");
	await new Promise((r) => setTimeout(r, 250));
	assert.equal(fired, false, "and no timer was left running");
});

test("Collection: 'fetch' fires with the models already in place", async () => {
	respond([{ id: 1 }, { id: 2 }]);
	const collection = new Collection(null, {});
	collection.url = "/api/books";

	let lengthWhenHeard = -1;
	collection.on("fetch", () => { lengthWhenHeard = collection.length; });

	await collection.fetch();
	assert.equal(lengthWhenHeard, 2);
});

test("Collection: parse() on its own emits nothing", async () => {
	const collection = new Collection();
	let fired = false;
	collection.on("fetch", () => { fired = true; });

	collection.parse([{ id: 1 }]);
	await new Promise((r) => setTimeout(r, 250));
	assert.equal(fired, false);
});
