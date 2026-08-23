// Using Model/Collection without an APP facade — run with: npm test
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Model, Collection } from "../dist/app.js";

afterEach(() => { delete globalThis.app; delete globalThis.fetch; });

test("isOnline() defaults to true when no app has been instantiated", () => {
	// regression: `_.isUndefined(app)` evaluates `app`, so this threw
	// "ReferenceError: app is not defined" outside a browser / before new APP()
	assert.equal(new Model().isOnline(), true);
	assert.equal(new Collection().isOnline(), true);
});

test("isOnline() reads app.state.online once an app is present", () => {
	globalThis.app = { state: { online: false } };
	assert.equal(new Model().isOnline(), false);
	assert.equal(new Collection().isOnline(), false);
	globalThis.app.state.online = true;
	assert.equal(new Model().isOnline(), true);
});

test("isOnline() tolerates a half-built app global", () => {
	globalThis.app = {};
	assert.equal(new Model().isOnline(), true, "no state yet -> assume online");
});

test("autofetch is a no-op when no url resolves", () => {
	let called = 0;
	globalThis.fetch = () => { called++; return Promise.reject(new Error("should not run")); };
	// regression: Model gained a default url() method in commit 29, so the old
	// `!_.isUndefined(this.url)` guard was always true and this threw
	// 'A "url" property or function must be specified' out of the constructor
	const m = new Model({}, { autofetch: true });
	assert.equal(called, 0);
	assert.equal(m.url(), null);
	new Collection(null, { autofetch: true });
	assert.equal(called, 0);
});

test("autofetch still fires when urlRoot resolves, and absorbs a failed request", async () => {
	let called = 0;
	globalThis.fetch = () => { called++; return Promise.reject(new TypeError("network down")); };
	class Thing extends Model { get urlRoot(){ return "/api/things"; } }
	new Thing({ id: 1 }, { autofetch: true });
	// let the rejected fetch settle - an unhandled rejection here would abort the run
	await new Promise((r) => setTimeout(r, 10));
	assert.equal(called, 1, "autofetch issued the request");
});
