// Constructor-lifecycle tests — run with: npm test  (node --test)
// Verifies that a subclass can declare routes/states via a getter without the
// old "Cannot set property ... which has only a getter" throw, and that the
// class built-ins still apply.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Model, Router, history } from "../dist/app.js";

test("subclass get states() no longer throws, and binds the state handler", () => {
	class Stateful extends Model {
		get states(){ return { "activated": "onActivated" }; }
		constructor(m, o){ super(m, o); this.hits = 0; }
		onActivated(){ this.hits++; }
	}
	let s;
	assert.doesNotThrow(() => { s = new Stateful(); });   // <- used to throw
	s.trigger("activated");
	assert.equal(s.hits, 1, "state event bound via the getter");
});

test("subclass get routes() no longer throws, and registers with history", () => {
	class MyRouter extends Router {
		get routes(){ return { "widgets/:id": "widget" }; }
		widget(){}
	}
	const before = history.handlers.length;
	let r;
	assert.doesNotThrow(() => { r = new MyRouter(); });   // <- used to throw
	r._bindRoutes();
	assert.ok(history.handlers.length > before, "the subclass route was registered");
});

test("options.states still merge (backward compatible)", () => {
	class Plain extends Model {
		constructor(m, o){ super(m, o); this.hits = 0; }
		onPing(){ this.hits++; }
	}
	const p = new Plain({}, { states: { "ping": "onPing" } });
	p.trigger("ping");
	assert.equal(p.hits, 1);
});
