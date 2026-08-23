// View machinery is created on demand — run with: npm test
//
// A view used to pay for an IntersectionObserver, a window resize listener, a
// Template and a state Model on construction, whether or not it used any of
// them. These pin the "only when needed" contract in both directions: nothing
// allocated when unused, everything working the moment it is.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mountDOM } from "./helpers/dom.js";
import { View, Model } from "../dist/app.js";

let dom;
beforeEach(() => { dom = mountDOM(`<div id="main"></div><div id="other"></div>`); });
afterEach(() => { dom.restore(); dom = null; });

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

test("a plain view allocates none of the optional machinery", () => {
	const before = dom.observers.length;
	const view = new View({ el: "#main", autoRender: false });

	assert.equal(dom.observers.length, before, "no IntersectionObserver");
	assert.equal(view.template, null, "no Template — there is nothing to compile");
	assert.equal(view._state, undefined, "no state Model");
});

test("500 views share ONE window resize listener", () => {
	let added = 0;
	const original = dom.window.addEventListener.bind(dom.window);
	dom.window.addEventListener = (type, fn, opts) => {
		if( type === "resize" ) added++;
		return original(type, fn, opts);
	};

	const views = [];
	for( let i = 0; i < 500; i++ ) views.push(new View({ autoRender: false }));
	// regression: this was one listener per view
	assert.ok(added <= 1, `expected at most 1 resize listener, got ${added}`);
	views.forEach((view) => view.remove());
});

test("the observer starts when something asks about visibility", () => {
	const view = new View({ el: "#main", autoRender: false });
	assert.equal(view.observer, undefined);

	view.on("visible", () => {});
	assert.ok(view.observer, "subscribing to `visible` starts it");
});

test("...or when isVisible() is called", () => {
	const view = new View({ el: "#main", autoRender: false });
	assert.equal(view.isVisible(), false);
	assert.ok(view.observer, "isVisible() starts it");
});

test("the observer is created once, however many times it is asked for", () => {
	const before = dom.observers.length;
	const view = new View({ el: "#main", autoRender: false });
	view.on("visible", () => {});
	view.on("hidden", () => {});
	view.isVisible();
	assert.equal(dom.observers.length - before, 1);
});

test("visibility still works end to end once started", () => {
	const view = new View({ el: "#main", autoRender: false });
	const seen = [];
	view.on("visible", () => seen.push("visible"));
	view.on("hidden", () => seen.push("hidden"));

	dom.intersect(view.el, true);
	assert.equal(view.isVisible(), true);
	dom.intersect(view.el, false);
	assert.deepEqual(seen, ["visible", "hidden"]);
});

test("a Template is built as soon as there is markup or a url", () => {
	assert.ok(new View({ el: "#main", html: "<b>x</b>" }).template, "html option");

	// stub fetch: the url branch starts a request we don't care about here
	const original = globalThis.fetch;
	globalThis.fetch = async () => ({ text: async () => "<b>remote</b>" });
	try {
		assert.ok(new View({ el: "#other", url: "/t.html", autoRender: false }).template, "url option");
	} finally {
		if( original ) globalThis.fetch = original; else delete globalThis.fetch;
	}
});

test("render() on a template-less view is a safe no-op", () => {
	dom.document.getElementById("main").innerHTML = "existing";
	const view = new View({ el: "#main", autoRender: false });
	assert.doesNotThrow(() => view.render());
	assert.equal(view.el.innerHTML, "existing", "existing markup is left alone");
});

test("resize only wakes views that override resize()", async () => {
	const plain = new View({ el: "#main", autoRender: false, resizeDelay: 10 });
	// spy on the plain view's dispatch entry point: the shared listener should
	// skip it entirely rather than schedule a debounce timer to call a no-op
	let plainCalls = 0;
	const plainResize = plain._resize.bind( plain );
	plain._resize = ( ...args ) => { plainCalls++; return plainResize( ...args ); };

	class Responsive extends View {
		resize(){ this.calls = ( this.calls || 0 ) + 1; }
	}
	const responsive = new Responsive({ el: "#other", autoRender: false, resizeDelay: 10 });

	dom.window.dispatchEvent(new dom.window.Event("resize"));
	await settle(40);

	assert.equal(responsive.calls, 1, "the overriding view ran");
	assert.equal(plainCalls, 0, "the plain view was never woken");
});

test("a resize handler assigned AFTER construction still fires", async () => {
	// the check is made at dispatch, not at registration, so late assignment works
	const view = new View({ el: "#main", autoRender: false, resizeDelay: 10 });
	let calls = 0;
	view.resize = () => { calls++; };

	dom.window.dispatchEvent(new dom.window.Event("resize"));
	await settle(40);
	assert.equal(calls, 1);
});

test("remove() unregisters from the shared listener", async () => {
	class Responsive extends View {
		resize(){ this.calls = ( this.calls || 0 ) + 1; }
	}
	const view = new Responsive({ el: "#main", autoRender: false, resizeDelay: 10 });

	dom.window.dispatchEvent(new dom.window.Event("resize"));
	await settle(40);
	assert.equal(view.calls, 1);

	view.remove();
	dom.window.dispatchEvent(new dom.window.Event("resize"));
	await settle(40);
	assert.equal(view.calls, 1, "no further resize handling after remove()");
});

test("state is created on first access and survives assignment", () => {
	const view = new View({ el: "#main", autoRender: false });
	assert.equal(view._state, undefined);
	assert.equal(view.state.get("visible"), false, "created on demand, with its defaults");
	assert.ok(view._state);

	const replacement = new Model({ custom: true });
	view.state = replacement;
	assert.equal(view.state, replacement, "still assignable");
});
