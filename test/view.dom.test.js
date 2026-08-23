// View / Layout against a REAL DOM (jsdom) — run with: npm test
//
// The view layer had no coverage at all: every previous test either avoided the
// DOM or hand-stubbed it (an EventTarget with `contains: () => true`), which
// cannot distinguish a working implementation from a broken one. These exercise
// the real thing.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mountDOM } from "./helpers/dom.js";
import { View, Layout, Model } from "../dist/app.js";

let dom;
beforeEach(() => { dom = mountDOM(`<div id="main"></div>`); });
afterEach(() => { dom.restore(); dom = null; });

class Panel extends View {
	get events(){ return { "click .btn": "onBtn" }; }
	onBtn(){ this.hits = ( this.hits || 0 ) + 1; }
}

test("delegateEvents: a real click on a matching descendant runs the handler", () => {
	const view = new Panel({ el: "#main", html: `<button class="btn">go</button>` });
	dom.click( view.el.querySelector(".btn") );
	assert.equal(view.hits, 1);
});

test("delegateEvents: it is TRUE delegation — a child added later also fires", () => {
	const view = new Panel({ el: "#main", html: `<button class="btn">go</button>` });
	// the selector is resolved at dispatch time, not at bind time, so an element
	// that did not exist when delegateEvents ran is still handled
	view.el.insertAdjacentHTML("beforeend", `<button class="btn" id="late">later</button>`);
	dom.click( view.el.querySelector("#late") );
	assert.equal(view.hits, 1);
	dom.click( view.el.querySelector(".btn") );
	assert.equal(view.hits, 2);
});

test("delegateEvents: non-matching targets are ignored, undelegateEvents unbinds", () => {
	const view = new Panel({
		el: "#main",
		html: `<button class="btn">go</button><button class="other">no</button>`
	});
	dom.click( view.el.querySelector(".other") );
	assert.equal(view.hits, undefined, "a target outside the selector does nothing");

	dom.click( view.el.querySelector(".btn") );
	assert.equal(view.hits, 1);

	view.undelegateEvents();
	dom.click( view.el.querySelector(".btn") );
	assert.equal(view.hits, 1, "no further handling after undelegateEvents");
});

test("delegateEvents: a selector-less entry binds to the root element", () => {
	class Root extends View {
		get events(){ return { "click": "onAny" }; }
		onAny(){ this.hits = ( this.hits || 0 ) + 1; }
	}
	const view = new Root({ el: "#main", html: `<span>inner</span>` });
	dom.click( view.el.querySelector("span") );   // bubbles to the root
	assert.equal(view.hits, 1);
});

test("_getEl: a selector string resolves; with no el a detached div is created", () => {
	const named = new View({ el: "#main", html: "<i>x</i>" });
	assert.equal(named.el.id, "main");

	const anonymous = new View({ html: "<i>x</i>" });
	assert.equal(anonymous.el.tagName, "DIV");
});

test("visibility: the IntersectionObserver drives visible/hidden and isVisible()", () => {
	const view = new View({ el: "#main", html: "<i>x</i>" });
	const seen = [];
	view.on("visible", () => seen.push("visible"));
	view.on("hidden", () => seen.push("hidden"));

	assert.equal(view.isVisible(), false, "starts hidden");
	dom.intersect(view.el, true);
	assert.equal(view.isVisible(), true);
	dom.intersect(view.el, true);   // no change -> no repeat event
	dom.intersect(view.el, false);
	assert.equal(view.isVisible(), false);
	assert.deepEqual(seen, ["visible", "hidden"]);
});

test("remove(): disconnects the observer and drops the tracked bindings", () => {
	const model = new Model({ title: "a" });
	const view = new View({ el: "#main", data: model, html: "<i>x</i>" });
	let renders = 0;
	view.render = () => { renders++; };
	view.listenTo(model, "change:title", view.render);

	model.set({ title: "b" });
	assert.equal(renders, 1);

	// visibility is observed lazily now - asking for it starts the observer
	view.isVisible();
	const observer = view.observer;
	assert.ok( observer, "isVisible() starts the observer on demand" );
	view.remove();
	assert.equal(observer.disconnected, true, "IntersectionObserver disconnected");

	model.set({ title: "c" });
	assert.equal(renders, 1, "stopListening ran, so the binding is gone");
});

test("Layout: binds to <body> and registers / unregisters child views", () => {
	const layout = new Layout({});
	assert.equal(layout.el, dom.document.body);
	assert.deepEqual(layout.views, {});

	const panel = new View({ el: "#main", html: "<i>x</i>" });
	layout.set({ panel });
	assert.equal(layout.get("panel"), panel);
	assert.equal(panel._name, "panel", "views are stamped with their key");

	layout.remove("panel");
	assert.deepEqual(Object.keys(layout.views), []);
});

test("Layout.findLink: skips in-page and target links, returns real hrefs", () => {
	dom.document.body.insertAdjacentHTML("beforeend", `
		<a id="internal" href="/page">i</a>
		<a id="anchor" href="#top">a</a>
		<a id="blank" href="/other" target="_blank">b</a>
		<a id="nested" href="/deep"><span id="child">c</span></a>
	`);
	const layout = new Layout({});
	const $ = (id) => dom.document.getElementById(id);

	assert.equal(layout.findLink($("internal")), "/page");
	assert.equal(layout.findLink($("anchor")), false, "in-page anchors are skipped");
	assert.equal(layout.findLink($("blank")), false, "target=_blank is skipped");
	assert.equal(layout.findLink($("child")), "/deep", "resolves through closest('a')");
});
