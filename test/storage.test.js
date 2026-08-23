// Storage availability / degradation — run with: npm test
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Model, Collection, Session } from "../dist/app.js";

let originalLocal, originalSession, originalDocument;
beforeEach(() => {
	originalLocal = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	originalSession = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
	originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
});
afterEach(() => {
	const put = (key, descriptor) => {
		if( descriptor ) Object.defineProperty(globalThis, key, descriptor);
		else delete globalThis[key];
	};
	put("localStorage", originalLocal);
	put("sessionStorage", originalSession);
	put("document", originalDocument);
});

const define = (key, value) =>
	Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });

function workingStorage(){
	const data = {};
	return {
		getItem: (k) => (k in data ? data[k] : null),
		setItem: (k, v) => { data[k] = String(v); },
		removeItem: (k) => { delete data[k]; }
	};
}

test("a present-but-useless localStorage is treated as unavailable", () => {
	// exactly what Node >= 22 exposes without a valid --localstorage-file:
	// the global is an object, but it has no Storage methods
	define("localStorage", {});
	const model = new Model({ id: 1 }, { cache: true });
	assert.equal(model.cache(), false, "cache() reports no storage instead of throwing");
	assert.equal(model.cache({ id: 1, name: "x" }), false);
	assert.equal(new Collection(null, { cache: true }).cache(), false);
});

test("a localStorage that throws on access degrades instead of breaking", () => {
	// a browser with site data blocked: the property exists but access throws
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		get(){ throw new Error("access denied"); }
	});
	const model = new Model({ id: 1 }, { cache: true });
	assert.equal(model.cache(), false);
});

test("a working localStorage still round-trips", () => {
	define("localStorage", workingStorage());
	const model = new Model({ id: 2 }, { cache: true });
	model.cache({ id: 2, name: "Ada" });
	assert.equal(model.cache().name, "Ada");
});

test("a cache:true model constructs cleanly with no storage at all", () => {
	delete globalThis.localStorage;
	assert.doesNotThrow(() => new Model({ id: 3 }, { cache: true }));
	assert.doesNotThrow(() => new Collection(null, { cache: true }));
});

test("Session falls back to memory when no browser storage exists", () => {
	delete globalThis.localStorage;
	delete globalThis.sessionStorage;
	delete globalThis.document;
	const session = new Session({}, { remote: false, broadcast: false, local: true });
	session.set({ auth: 1, updated: Date.now() });
	// the in-memory store keeps the session usable for the life of the process
	assert.equal(JSON.parse(session.store.get("session")).auth, 1);
});

test("Session prefers sessionStorage when it actually works", () => {
	define("sessionStorage", workingStorage());
	const session = new Session({}, { remote: false, broadcast: false });
	assert.equal(typeof session.store.available, "function");
	assert.equal(session.store.available(), true);
	session.cache();
	assert.ok(globalThis.sessionStorage.getItem("session"), "written through sessionStorage");
});

test("Session skips a present-but-useless sessionStorage", () => {
	define("sessionStorage", {});           // Node-style stub
	define("localStorage", {});             // also useless
	delete globalThis.document;             // no cookies either
	const session = new Session({}, { remote: false, broadcast: false });
	assert.equal(session.store.available(), true, "resolved to the memory fallback");
	assert.doesNotThrow(() => session.cache());
});

test("check() means the same thing in every store", () => {
	define("sessionStorage", workingStorage());
	const session = new Session({}, { remote: false, broadcast: false });
	assert.equal(session.store.check("nothing-here"), true, "empty slot -> true");
	session.store.set("something", "1");
	assert.equal(session.store.check("something"), false, "occupied slot -> false");
});
