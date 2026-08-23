// Layout teardown and child-view management — run with: npm test
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mountDOM } from "./helpers/dom.js";
import { Layout, View, Model } from "../dist/app.js";

let dom;
beforeEach(() => { dom = mountDOM(`<div id="a"></div><div id="b"></div>`); });
afterEach(() => { dom.restore(); dom = null; });

test("remove() with no arguments tears the layout down", () => {
	const layout = new Layout({});
	const model = new Model({ x: 1 });
	layout.listenTo( model, "change", () => {} );
	assert.equal( layout._listeningTo.length, 1 );

	// regression: remove() and remove(name) were the same method with
	// incompatible signatures, so this looked up this.views[undefined], found
	// nothing and returned — a Layout could never be torn down
	layout.remove();
	assert.equal( layout._listeningTo.length, 0, "listenTo bindings dropped" );
});

test("remove() does NOT detach the element", () => {
	const layout = new Layout({});
	assert.equal( layout.el, dom.document.body );
	layout.remove();
	// View#remove() detaches; for a Layout that would take <body> out of the page
	assert.ok( dom.document.body, "the document still has a body" );
	assert.ok( dom.document.getElementById("a"), "the page survives" );
});

test("remove() drops the link handler", () => {
	const layout = new Layout({});
	let clicks = 0;
	layout._clickLink = () => { clicks++; };

	dom.document.body.insertAdjacentHTML("beforeend", `<a id="go" href="/x">go</a>`);
	dom.click( dom.document.getElementById("go") );
	assert.equal( clicks, 1 );

	layout.remove();
	dom.click( dom.document.getElementById("go") );
	assert.equal( clicks, 1, "the click listener went with the layout" );
});

test("remove() tears down every registered child view", () => {
	const layout = new Layout({});
	const first = new View({ el: "#a", html: "<i>1</i>" });
	const second = new View({ el: "#b", html: "<i>2</i>" });
	layout.set({ first, second });

	layout.remove();
	assert.deepEqual( Object.keys( layout.views ), [], "the registry is empty" );
});

test("removeView(name) removes one child and leaves the rest", () => {
	const layout = new Layout({});
	const first = new View({ el: "#a", html: "<i>1</i>" });
	const second = new View({ el: "#b", html: "<i>2</i>" });
	layout.set({ first, second });

	layout.removeView("first");
	assert.deepEqual( Object.keys( layout.views ), ["second"] );
	assert.equal( layout.get("second"), second );
});

test("remove(name) still works, delegating to removeView", () => {
	const layout = new Layout({});
	const panel = new View({ el: "#a", html: "<i>x</i>" });
	layout.set({ panel });

	layout.remove("panel");
	assert.deepEqual( Object.keys( layout.views ), [] );
});

test("removeView() on an unknown name is a no-op", () => {
	const layout = new Layout({});
	assert.doesNotThrow( () => layout.removeView("nope") );
	assert.equal( layout.removeView("nope"), layout, "still chainable" );
});

test("app.views.remove() can now tear down a Layout", () => {
	// the registry calls view.remove() with no arguments - which used to be a
	// silent no-op for a Layout
	const layout = new Layout({});
	const model = new Model({ x: 1 });
	layout.listenTo( model, "change", () => {} );

	const registry = { _views: { main: layout } };
	// mimic Views#remove
	if( typeof registry._views.main.remove === "function" ) registry._views.main.remove();
	assert.equal( layout._listeningTo.length, 0 );
});
