// APP facade tests — run with: npm test  (node --test)
// The facade's sub-objects are testable without a DOM; the router resolution
// (app.ready) needs a browser, so we only assert its shape here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { APP } from "../dist/app.js";

// build a facade and register teardown (the shared bus opens a BroadcastChannel
// that would otherwise keep the process alive)
function makeApp(t) {
	const app = new APP();
	if (app.ready && typeof app.ready.catch === "function") app.ready.catch(() => {});
	t.after(() => { if (app.events) app.events.close(); });
	return app;
}

test("APP facade: exposes events/state/views/ready as siblings", (t) => {
	const app = makeApp(t);
	// the bus
	assert.equal(typeof app.events.on, "function");
	assert.equal(typeof app.events.trigger, "function");
	// device/env state (SSR-safe defaults)
	assert.equal(typeof app.state, "object");
	assert.equal(app.state.online, true);
	assert.equal(typeof app.state.browser, "function");
	// the view registry
	assert.equal(typeof app.views.add, "function");
	// the startup promise (distinct from the static DOM-ready helper)
	assert.ok(app.ready instanceof Promise);
	assert.equal(typeof APP.ready, "function");
});

test("APP facade: the shared bus works off the facade", (t) => {
	const app = makeApp(t);
	let seen = null;
	app.events.on("slideshow:next", (frame) => { seen = frame; });
	app.events.trigger("slideshow:next", 7);
	assert.equal(seen, 7);
});

test("APP facade: Views registry add/get/remove/each", (t) => {
	const app = makeApp(t);
	let removed = 0;
	const fakeView = { remove() { removed++; } };
	app.views.add("main", fakeView);
	assert.equal(app.views.get("main"), fakeView);
	let count = 0;
	app.views.each(() => count++);
	assert.equal(count, 1);
	app.views.remove("main");
	assert.equal(removed, 1);
	assert.equal(app.views.get("main"), undefined);
});
