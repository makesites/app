// Collection: index + get/remove/reset + populate — run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { Collection } from "../dist/app.js";

test("populate from constructor + O(1) get by id/cid; at() by index", () => {
	const c = new Collection([{ id: "a1", v: 1 }, { id: "a2", v: 2 }]);
	assert.equal(c.length, 2, "constructor populates (was ignored before)");
	assert.equal(c.get("a1").get("v"), 1, "get by string id");
	assert.equal(c.get("a2").get("v"), 2);
	const m = c.at(0);
	assert.equal(c.get(m.cid), m, "get by cid");
	assert.equal(c.at(1).get("v"), 2, "at() by index");
});

test("add fires 'add' and indexes the model", () => {
	const c = new Collection();
	let added = 0;
	c.on("add", () => added++);
	c.add({ id: "z", v: 9 });
	assert.equal(added, 1);
	assert.equal(c.get("z").get("v"), 9);
	assert.equal(c.length, 1);
});

test("remove by id / model, fires 'remove', updates the index", () => {
	const c = new Collection([{ id: "x", v: 1 }, { id: "y", v: 2 }]);
	let removed = null;
	c.on("remove", (m) => { removed = m.get("id"); });
	const gone = c.remove("x");
	assert.equal(gone.get("id"), "x");
	assert.equal(removed, "x");
	assert.equal(c.length, 1);
	assert.equal(c.get("x"), null, "index no longer resolves the removed model");
	c.remove(c.at(0));               // remove by model instance
	assert.equal(c.length, 0);
});

test("reset replaces all and fires a single 'reset'", () => {
	const c = new Collection([{ id: "a", v: 1 }]);
	let resets = 0;
	c.on("reset", () => resets++);
	c.reset([{ id: "b", v: 2 }, { id: "c", v: 3 }]);
	assert.equal(resets, 1);
	assert.equal(c.length, 2);
	assert.equal(c.get("a"), null, "old model gone");
	assert.equal(c.get("b").get("v"), 2);
});
