// The `_` helpers — API unchanged, internals native. Run with: npm test
//
// These pin the *contract* of each helper, so the implementations can keep being
// tuned without anyone having to re-derive what they were supposed to do.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Model } from "../dist/app.js";

// The `_` singleton is internal to the bundle and not exported, so these drive
// it through Model — which leans on extend / isEmpty / isEqual / result /
// uniqueId on nearly every call.
test("extend: merges own-enumerable keys and MUTATES the destination", () => {
	// Model#set uses _.extend on the attributes; a non-mutating extend would
	// silently drop everything (the commit-13 regression)
	const model = new Model({ a: 1 });
	model.set({ b: 2 });
	assert.deepEqual( model.toJSON(), { a: 1, b: 2 } );
});

test("extend: a falsy source is skipped rather than throwing", () => {
	// `_.extend({}, undefined)` happens all over the option-merging paths
	assert.doesNotThrow( () => new Model( undefined, undefined ) );
	assert.deepEqual( new Model().toJSON(), {} );
});

test("extend: later sources win", () => {
	class Book extends Model {
		get defaults(){ return { title: "untitled", read: false }; }
	}
	// defaults first, then the passed attributes
	assert.deepEqual( new Book({ title: "Middlemarch" }).toJSON(), { title: "Middlemarch", read: false } );
});

test("isEmpty: PHP-style semantics are preserved", () => {
	// 0 / false / "0" count as empty — unchanged by the native rewrite, because
	// hasChanged() and the View render gate both depend on it
	const model = new Model();
	assert.equal( model.hasChanged(), false, "no changes -> changed hash is empty" );
	model.set({ count: 1 });
	assert.equal( model.hasChanged(), true );
});

test("isEmpty: an object with own keys is not empty", () => {
	const model = new Model({ a: 1 });
	model.set({ a: 2 });
	assert.equal( model.hasChanged("a"), true );
	assert.deepEqual( model.changedAttributes(), { a: 2 } );
});

test("isEqual: primitives short-circuit, objects compare by value", () => {
	const model = new Model({ n: 1, list: [1, 2] });
	let changes = 0;
	model.on("change", () => changes++);

	model.set({ n: 1 });                       // identical primitive
	assert.equal( changes, 0, "no-op set is silent" );

	model.set({ list: [1, 2] });               // equal-by-value array
	assert.equal( changes, 0, "structurally equal value is not a change" );

	model.set({ list: [1, 2, 3] });
	assert.equal( changes, 1 );
});

test("isEqual: a circular value is treated as changed, not thrown", () => {
	const circular = {}; circular.self = circular;
	const model = new Model();
	assert.doesNotThrow( () => model.set({ circular }) );
});

test("uniqueId: ids are unique within the same millisecond", () => {
	// the time-based implementation collided here (fixed in commit 30)
	const ids = new Set();
	for( let i = 0; i < 500; i++ ) ids.add( new Model().cid );
	assert.equal( ids.size, 500 );
});

test("result: resolves a value, a getter and a method alike", () => {
	class A extends Model { get urlRoot(){ return "/a"; } }
	class B extends Model { urlRoot(){ return "/b"; } }
	assert.equal( new A({ id: 1 }).url(), "/a/1" );
	assert.equal( new B({ id: 1 }).url(), "/b/1" );
});
