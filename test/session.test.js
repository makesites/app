// Session tests — run with: npm test  (node --test)
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Session } from "../dist/app.js";

function mockStorage() {
	const s = {};
	return {
		getItem: (k) => (k in s ? s[k] : null),
		setItem: (k, v) => { s[k] = String(v); },
		removeItem: (k) => { delete s[k]; },
		_s: s,
	};
}

let origSS;
beforeEach(() => { origSS = global.sessionStorage; global.sessionStorage = mockStorage(); });
afterEach(() => { global.sessionStorage = origSS; });

test("Session picks sessionStorage and initializes without a super() crash", () => {
	// (constructor previously never called super() -> would throw)
	const s = new Session({}, { remote: false, local: false, broadcast: false });
	assert.equal(s.store === undefined, false, "a storage engine was chosen");
});

test("Session (remote off) reaches the loaded state and caches locally", () => {
	const s = new Session({}, { remote: false, local: false, broadcast: false });
	assert.equal(s.state, true, "loaded -> state true");
	assert.ok(global.sessionStorage.getItem("session"), "session written to storage");
});

test("Session.parse adds an updated timestamp and an id", () => {
	const s = new Session({}, { remote: false, local: false, broadcast: false });
	const parsed = s.parse({ auth: 1 });
	assert.equal(typeof parsed.updated, "number");
	assert.ok(parsed.id, "an id is generated when missing");
});
