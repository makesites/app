// Collection lookup + dedup tests — run with: npm test  (node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { Collection, Model } from "../dist/app.js";

test("get(): a numeric id resolves through the index, not as an array position", () => {
	const c = new Collection([{ id: 1, title: "B" }, { id: 9, title: "A" }]);
	// regression: get(9) used to return this.data[9] (undefined) because the
	// integer-as-index branch shadowed the _byId index
	assert.equal(c.get(9).get("title"), "A");
	assert.equal(c.get(1).get("title"), "B");
	// the string form resolves to the same model (object keys are strings)
	assert.equal(c.get("9"), c.get(9));
});

test("get(): index access survives as a fallback, and at() is the explicit form", () => {
	const c = new Collection([{ id: "a" }, { id: "b" }, { id: "c" }]);
	// no model has the id 1, so the integer falls through to the array position
	assert.equal(c.get(1), c.at(1));
	assert.equal(c.at(1).get("id"), "b");
	assert.equal(c.get(99), null, "out of range index -> null (get() always returns ?Model)");
});

test("get(): accepts a cid and a model instance", () => {
	const c = new Collection([{ id: 4 }]);
	const m = c.get(4);
	assert.equal(c.get(m.cid), m);
	assert.equal(c.get(m), m);
	assert.equal(c.get(new Model({ id: 4 })), null, "a stranger model isn't a member");
});

test("get(): an id colliding with an Object.prototype key doesn't leak a builtin", () => {
	const c = new Collection([{ id: "x" }]);
	assert.equal(c.get("constructor"), null);
	assert.equal(c.get("toString"), null);
});

test("add(): duplicate ids inside ONE batch are deduped (first wins)", () => {
	const c = new Collection();
	c.add([{ id: 1, n: "a" }, { id: 1, n: "b" }, { id: 2, n: "c" }]);
	assert.equal(c.length, 2);
	assert.equal(c.get(1).get("n"), "a", "add() does not merge (Backbone semantics)");
	assert.equal(c.get(2).get("n"), "c");
});

test("set(): duplicate ids inside ONE batch merge into a single model", () => {
	const c = new Collection();
	c.set([{ id: 1, n: "a" }, { id: 1, n: "b" }]);
	assert.equal(c.length, 1);
	assert.equal(c.get(1).get("n"), "b", "set() merges the later attributes");
});

test("the constructor dedupes duplicate ids too", () => {
	const c = new Collection([{ id: 7 }, { id: 7 }, { id: 8 }]);
	assert.equal(c.length, 2);
	assert.deepEqual(c.pluck("id"), [7, 8]);
});

test("dedup keeps the index consistent after a remove", () => {
	const c = new Collection();
	c.add([{ id: 3 }, { id: 3 }]);
	assert.equal(c.length, 1);
	c.remove(3);
	assert.equal(c.length, 0);
	assert.equal(c.get(3), null);
});
