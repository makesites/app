// View render target + resize lifecycle — run with: npm test
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mountDOM } from "./helpers/dom.js";
import { View } from "../dist/app.js";

let dom;
beforeEach(() => {
	dom = mountDOM(`<div id="main"><div class="slot"></div></div><div class="slot" id="outside"></div>`);
});
afterEach(() => { dom.restore(); dom = null; });

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

test("renderTarget: a selector matching INSIDE the element wins", () => {
	const view = new View({ el: "#main", renderTarget: ".slot", html: "<b>in</b>" });
	// regression: the in-element match was discarded (`container.length` on an
	// Element is undefined) and the document-wide lookup always won, so the
	// documented "renderTarget inside the element" case never worked
	assert.equal(view.el.querySelector(".slot").innerHTML, "<b>in</b>");
	assert.equal(dom.document.getElementById("outside").innerHTML, "", "the outside match is untouched");
});

test("renderTarget: falls back to the document when nothing matches inside", () => {
	new View({ el: "#main", renderTarget: "#outside", html: "<b>out</b>" });
	assert.equal(dom.document.getElementById("outside").innerHTML, "<b>out</b>");
});

test("renderTarget: an unmatched selector renders into the element instead of throwing", () => {
	// regression: this threw `Cannot read properties of undefined (reading 'length')`
	const view = new View({ el: "#main", renderTarget: ".nowhere", html: "<b>fallback</b>" });
	assert.equal(view.el.innerHTML, "<b>fallback</b>");
});

test("renderTarget: an element can be passed directly", () => {
	const target = dom.document.getElementById("outside");
	new View({ el: "#main", renderTarget: target, html: "<b>direct</b>" });
	assert.equal(target.innerHTML, "<b>direct</b>");
});

test("resize is debounced across a burst of events", async () => {
	const view = new View({ el: "#main", html: "<i>x</i>", resizeDelay: 20 });
	let resized = 0;
	view.resize = () => { resized++; };

	// regression: the debounce timer was a local variable, so clearTimeout()
	// cleared nothing and each event scheduled its own callback
	for( let i = 0; i < 5; i++ ) dom.window.dispatchEvent(new dom.window.Event("resize"));
	await settle(60);
	assert.equal(resized, 1, "one call for the whole burst");
});

test("remove() detaches the window resize listener", async () => {
	const view = new View({ el: "#main", html: "<i>x</i>", resizeDelay: 20 });
	let resized = 0;
	view.resize = () => { resized++; };

	dom.window.dispatchEvent(new dom.window.Event("resize"));
	await settle(60);
	assert.equal(resized, 1);

	// regression: remove() passed the prototype method to removeEventListener
	// while an inline .bind(this) had been registered, so the listener - and the
	// view it closed over - stayed alive for the life of the page
	view.remove();
	dom.window.dispatchEvent(new dom.window.Event("resize"));
	await settle(60);
	assert.equal(resized, 1, "no further resize handling after remove()");
});

test("remove() cancels a pending debounced resize", async () => {
	const view = new View({ el: "#main", html: "<i>x</i>", resizeDelay: 40 });
	let resized = 0;
	view.resize = () => { resized++; };

	dom.window.dispatchEvent(new dom.window.Event("resize"));
	view.remove();
	await settle(80);
	assert.equal(resized, 0, "the queued callback never runs on a removed view");
});

test("remove() undelegates the DOM events", () => {
	class Panel extends View {
		get events(){ return { "click .btn": "onBtn" }; }
		onBtn(){ this.hits = ( this.hits || 0 ) + 1; }
	}
	const view = new Panel({ el: "#main", html: `<button class="btn">go</button>` });
	const el = view.el;
	dom.click( el.querySelector(".btn") );
	assert.equal(view.hits, 1);

	view.remove();
	dom.click( el.querySelector(".btn") );
	assert.equal(view.hits, 1, "the delegated listener went with the view");
});
