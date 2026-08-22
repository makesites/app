// Model: attribute defaults + urlRoot — run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { Model } from "../dist/app.js";

test("attribute defaults: get defaults() seeds attributes; passed model overrides", () => {
	class Book extends Model {
		get defaults(){ return { title: "", read: false }; }
	}
	const b = new Book({ title: "Dune" });
	assert.equal(b.get("title"), "Dune", "passed value wins");
	assert.equal(b.get("read"), false, "default seeded");

	// reset() restores the attribute defaults
	b.set({ title: "X", read: true });
	b.reset();
	assert.equal(b.get("title"), "");
	assert.equal(b.get("read"), false);
});

test("framework option defaults stay in options, not attributes", () => {
	const m = new Model({ a: 1 });
	assert.equal(m.get("autofetch"), undefined, "autofetch is an option, not an attribute");
	assert.equal(m.options.autofetch, false);
	assert.equal(m.options.cache, false);
});

test("url(): urlRoot + id; new -> base; a url getter overrides", () => {
	class Doc extends Model { get urlRoot(){ return "/api/docs"; } }
	assert.equal(new Doc().url(), "/api/docs", "new -> base");
	assert.equal(new Doc({ id: 7 }).url(), "/api/docs/7");

	class Custom extends Model { get url(){ return "/custom"; } }
	assert.equal(new Custom().url, "/custom");
});
