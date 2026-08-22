// Collection: smart set / comparator / model-event forwarding — npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { Collection } from "../dist/app.js";

test("set(): merges existing (by id), adds new, removes missing", () => {
	const c = new Collection([{ id: "a", v: 1 }, { id: "b", v: 2 }]);
	const added = [], removed = [];
	c.on("add", (m) => added.push(m.get("id")));
	c.on("remove", (m) => removed.push(m.get("id")));
	c.set([{ id: "a", v: 99 }, { id: "c", v: 3 }]);   // merge a, add c, remove b
	assert.equal(c.length, 2);
	assert.equal(c.get("a").get("v"), 99, "merged");
	assert.equal(c.get("c").get("v"), 3, "added");
	assert.equal(c.get("b"), null, "removed");
	assert.deepEqual(added, ["c"]);
	assert.deepEqual(removed, ["b"]);
});

test("add(): dedups by id and does not remove", () => {
	const c = new Collection([{ id: "a", v: 1 }]);
	c.add([{ id: "a", v: 2 }, { id: "b", v: 3 }]);
	assert.equal(c.length, 2, "no duplicate for id 'a'");
	assert.equal(c.get("a").get("v"), 1, "add() with merge:false keeps the existing model");
	assert.equal(c.get("b").get("v"), 3);
});

test("comparator: keeps the collection sorted; sort() fires 'sort'", () => {
	const c = new Collection([], { comparator: "order" });
	c.add([{ id: 1, order: 3 }, { id: 2, order: 1 }, { id: 3, order: 2 }]);
	assert.deepEqual(c.pluck("order"), [1, 2, 3], "sorted on add");
	let sorted = 0;
	c.on("sort", () => sorted++);
	c.sort();
	assert.equal(sorted, 1);
});

test("model-event forwarding: member change/destroy bubble to the collection", () => {
	const c = new Collection([{ id: "a", v: 1 }]);
	let changed = null, destroyed = null;
	c.on("change", (m) => changed = m.get("id"));
	c.on("destroy", (m) => destroyed = m.get("id"));
	const a = c.get("a");
	a.set({ v: 2 });
	assert.equal(changed, "a", "member change forwarded");
	a.trigger("destroy", a, c, {});   // simulate a destroy
	assert.equal(destroyed, "a");
	assert.equal(c.length, 0, "destroyed member auto-removed");
});
