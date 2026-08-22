// Router tests — run with: npm test  (node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { Router } from "../dist/app.js";

test("Router._routeToRegExp: named params + decoded extraction", () => {
	const r = new Router();
	const re = r._routeToRegExp("books/:id/pages/:page");
	assert.ok(re.test("books/12/pages/3"));
	// the trailing element is the (absent) query string, per Backbone convention
	assert.deepEqual(r._extractParameters(re, "books/12/pages/3"), ["12", "3", null]);
	// named params are URI-decoded
	assert.deepEqual(r._extractParameters(re, "books/a%20b/pages/3"), ["a b", "3", null]);
});

test("Router._routeToRegExp: optional group + splat", () => {
	const r = new Router();
	const opt = r._routeToRegExp("search(/:q)");
	assert.ok(opt.test("search"));
	assert.ok(opt.test("search/hi"));

	const splat = r._routeToRegExp("files/*path");
	assert.ok(splat.test("files/a/b/c.txt"));
	assert.equal(r._extractParameters(splat, "files/a/b/c.txt")[0], "a/b/c.txt");
});

test("Router.execute: overriding to return false cancels the route (guard)", () => {
	class Guarded extends Router {
		execute(callback, args) {
			if (this.blocked) return false;
			return super.execute(callback, args);
		}
	}
	const g = new Guarded();
	let ran = 0;
	const cb = () => ran++;

	g.blocked = true;
	assert.equal(g.execute(cb, []), false);
	assert.equal(ran, 0);

	g.blocked = false;
	g.execute(cb, []);
	assert.equal(ran, 1);
});
