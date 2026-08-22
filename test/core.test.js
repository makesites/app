// Core unit tests — run with: npm test  (node --test)
// Imports the built bundle; run `npm run build` first so dist/app.js is current.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Model, Collection, Template } from "../dist/app.js";

test("Model: get/set/isNew/clear", () => {
	const m = new Model({ id: 5, name: "x" });
	assert.equal(m.get("id"), 5);
	assert.equal(m.isNew(), false);
	assert.equal(new Model({ name: "y" }).isNew(), true);
	m.set("z", 9);
	assert.equal(m.get("z"), 9);
	assert.equal(m.toJSON().name, "x");
	m.clear();
	assert.equal(m.get("id"), undefined);
});

test("Model: change event delivers payload with correct `this`", () => {
	const m = new Model({ id: 1 });
	let seen = null;
	m.on("change", function (model) { seen = { isModel: model === m, thisIsModel: this === m }; });
	m.set("name", "X");
	assert.ok(seen && seen.isModel && seen.thisIsModel);
});

test("Model: change:<attr> fires with the new value; no-op set is silent", () => {
	const m = new Model({ name: "A" });
	let value = null, count = 0;
	m.on("change:name", (model, v) => { value = v; count++; });
	m.set("name", "B");
	assert.equal(value, "B");
	m.set("name", "B"); // unchanged -> should not fire
	assert.equal(count, 1);
});

test("Model: object attribute with circular ref does not throw", () => {
	const m = new Model();
	const circ = {}; circ.self = circ;
	assert.doesNotThrow(() => m.set("node", circ));
});

test("Collection: add(array) + native array methods", () => {
	const c = new Collection();
	c.add([{ id: 1, v: 10 }, { id: 2, v: 20 }, { id: 3, v: 30 }]);
	assert.equal(c.length, 3);
	assert.deepEqual(c.pluck("v"), [10, 20, 30]);
	assert.equal(c.filter(x => x.get("v") >= 20).length, 2);
	assert.equal(c.map(x => x.get("v")).reduce((a, b) => a + b, 0), 60);
	assert.equal(c.find(x => x.get("id") === 2).get("v"), 20);
	assert.equal(c.where({ v: 20 }).length, 1);
	assert.equal(c.at(0).get("id"), 1);
	assert.deepEqual(c.toJSON(), [{ id: 1, v: 10 }, { id: 2, v: 20 }, { id: 3, v: 30 }]);
});

test("Events: on/once/off + space-separated names", () => {
	const c = new Collection();
	let hits = 0, onceHits = 0;
	c.on("add remove", () => hits++);
	c.trigger("add");
	c.trigger("remove");
	assert.equal(hits, 2);
	c.once("ping", () => onceHits++);
	c.trigger("ping");
	c.trigger("ping");
	assert.equal(onceHits, 1);
	const cb = () => hits++;
	c.on("x", cb);
	c.off("x", cb);
	c.trigger("x");
	assert.equal(hits, 2);
});

test("Template: compiles, renders and escapes interpolated data", () => {
	const t = new Template("<b>${title}</b>");
	const render = t.get("default");
	assert.equal(typeof render, "function");
	assert.equal(render({ title: "Hi" }), "<b>Hi</b>");
	assert.equal(render({ title: "<script>x</script>" }), "<b>&lt;script&gt;x&lt;/script&gt;</b>");
});
