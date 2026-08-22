// Collection Underscore-parity helpers — run with: npm test  (node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { Collection } from "../dist/app.js";

// id1: type a, n 3 | id2: type b, n 1 | id3: type a, n 2
const sample = () => new Collection([
	{ id: 1, type: "a", n: 3 },
	{ id: 2, type: "b", n: 1 },
	{ id: 3, type: "a", n: 2 },
]);
const ids = (models) => models.map((m) => m.get("id"));

test("groupBy: by attribute name and by function", () => {
	const c = sample();
	assert.equal(c.groupBy("type").a.length, 2);
	assert.equal(c.groupBy("type").b.length, 1);
	const parity = c.groupBy((m) => (m.get("n") % 2 ? "odd" : "even"));
	assert.deepEqual(ids(parity.odd), [1, 2]);
	assert.deepEqual(ids(parity.even), [3]);
});

test("countBy tallies the buckets", () => {
	assert.deepEqual(sample().countBy("type"), { a: 2, b: 1 });
});

test("sortBy returns a sorted copy without mutating the collection", () => {
	const c = sample();
	assert.deepEqual(c.sortBy("n").map((m) => m.get("n")), [1, 2, 3]);
	assert.deepEqual(ids(c), [1, 2, 3], "original order untouched (unlike sort())");
});

test("sortBy is stable for equal keys", () => {
	const c = sample();
	// everything maps to the same key -> original relative order preserved
	assert.deepEqual(ids(c.sortBy(() => 0)), [1, 2, 3]);
});

test("invoke calls a named method on every model", () => {
	assert.deepEqual(sample().invoke("get", "type"), ["a", "b", "a"]);
});

test("partition splits into [pass, fail] by a predicate", () => {
	const [big, small] = sample().partition((m) => m.get("n") >= 2);
	assert.deepEqual(ids(big), [1, 3]);
	assert.deepEqual(ids(small), [2]);
});

test("min / max by attribute return the extreme model", () => {
	const c = sample();
	assert.equal(c.min("n").get("id"), 2, "n=1 is smallest");
	assert.equal(c.max("n").get("id"), 1, "n=3 is largest");
});

test("min / max on an empty collection are undefined", () => {
	const c = new Collection();
	assert.equal(c.min("n"), undefined);
	assert.equal(c.max("n"), undefined);
});

test("sample() returns a member; sample(n) returns n distinct members", () => {
	const c = sample();
	assert.ok(c.includes(c.sample()));
	const picked = c.sample(2);
	assert.equal(picked.length, 2);
	assert.notEqual(picked[0], picked[1]);
	picked.forEach((m) => assert.ok(c.includes(m)));
	assert.equal(c.sample(99).length, 3, "n is clamped to the collection size");
});
