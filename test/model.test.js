// Model: idAttribute / validation / change-tracking — run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { Model } from "../dist/app.js";

test("idAttribute: default id + isNew; custom idAttribute via getter", () => {
	assert.equal(new Model({ id: 1 }).isNew(), false);
	assert.equal(new Model().isNew(), true);

	class Doc extends Model { get idAttribute(){ return "_id"; } }
	const d = new Doc({ _id: "abc" });
	assert.equal(d.isNew(), false);
	assert.equal(d.id, "abc", "this.id mirrors the id attribute");
});

test("change tracking: hasChanged / previous / changedAttributes", () => {
	const m = new Model({ a: 1, b: 2 });
	m.set({ a: 9 });
	assert.equal(m.hasChanged(), true);
	assert.equal(m.hasChanged("a"), true);
	assert.equal(m.hasChanged("b"), false);
	assert.equal(m.previous("a"), 1);
	assert.deepEqual(m.changedAttributes(), { a: 9 });

	// a no-op set clears the changed set
	m.set({ a: 9 });
	assert.equal(m.hasChanged("a"), false);
	assert.equal(m.hasChanged(), false);
});

test("validation: validate() blocks (with validate option) and fires invalid", () => {
	class Person extends Model {
		validate(attrs){ if (!attrs.name) return "name required"; }
	}
	const p = new Person({ name: "Ada" });
	let invalid = null;
	p.on("invalid", (m, err) => { invalid = err; });

	// no validate option -> not validated (returns the model)
	assert.ok(p.set({ nick: "a" }) instanceof Person);

	// with validate -> blocked, returns false, fires invalid
	const r = p.set({ name: "" }, { validate: true });
	assert.equal(r, false);
	assert.equal(invalid, "name required");
	assert.equal(p.validationError, "name required");
});

test("save() validates by default and aborts when invalid", () => {
	class Person extends Model {
		get url(){ return "/p"; }
		validate(attrs){ if (!attrs.name) return "name required"; }
	}
	const p = new Person({ name: "Ada" });
	assert.equal(p.save({ name: "" }), false, "invalid save returns false (no request)");
});
