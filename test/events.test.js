// Events bus unit tests — run with: npm test  (node --test)
// Run `npm run build` first so dist/app.js is current.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Events } from "../dist/app.js";

test("Events bus: decoupled in-page pub/sub delivers synchronously", () => {
	const bus = new Events("t-deliver", { broadcast: false });
	let frame = null;
	// a subscriber that holds no reference to the publisher
	bus.on("slideshow:next", (n) => { frame = n; });
	bus.trigger("slideshow:next", 3);
	assert.equal(frame, 3);
	bus.close();
});

test("Events bus: multiple subscribers + space-separated topics", () => {
	const bus = new Events("t-multi", { broadcast: false });
	let a = 0, b = 0;
	bus.on("prev next", () => a++);
	bus.on("next", () => b++);
	bus.trigger("next");
	bus.trigger("prev");
	assert.equal(a, 2);
	assert.equal(b, 1);
	bus.close();
});

test("Events bus: off() and once()", () => {
	const bus = new Events("t-offonce", { broadcast: false });
	let n = 0;
	const fn = () => n++;
	bus.on("x", fn);
	bus.trigger("x");
	bus.off("x", fn);
	bus.trigger("x");
	assert.equal(n, 1);

	let m = 0;
	bus.once("y", () => m++);
	bus.trigger("y");
	bus.trigger("y");
	assert.equal(m, 1);
	bus.close();
});

test("Events bus: broadcast disabled -> no channel; enabled -> channel present", () => {
	const local = new Events("t-local", { broadcast: false });
	assert.equal(local.broadcast, false);
	assert.ok(!local._channel);
	local.close();

	if (typeof BroadcastChannel !== "undefined") {
		const wired = new Events("t-wired");
		assert.equal(wired.broadcast, true);
		assert.ok(wired._channel);
		wired.close();
	}
});
