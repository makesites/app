// View element creation (Backbone's tagName / className / id / attributes)
// Run with: npm test
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mountDOM } from "./helpers/dom.js";
import { View } from "../dist/app.js";

let dom;
beforeEach(() => { dom = mountDOM(`<div id="main"></div>`); });
afterEach(() => { dom.restore(); dom = null; });

test("with no el, a <div> is still the default", () => {
	const view = new View({ autoRender: false });
	assert.equal( view.el.tagName, "DIV" );
});

test("tagName / className / id / attributes are honoured from options", () => {
	// regression: all four were ignored - every el-less view got a bare <div>
	const view = new View({
		tagName: "li",
		className: "card selected",
		id: "book-9",
		attributes: { "data-role": "item", "aria-label": "Book" },
		autoRender: false
	});
	assert.equal( view.el.tagName, "LI" );
	assert.equal( view.el.getAttribute("class"), "card selected" );
	assert.equal( view.el.getAttribute("id"), "book-9" );
	assert.equal( view.el.getAttribute("data-role"), "item" );
	assert.equal( view.el.getAttribute("aria-label"), "Book" );
});

test("the same declarations work on a subclass", () => {
	class Row extends View {
		get tagName(){ return "tr"; }
		get className(){ return "row"; }
		get attributes(){ return { role: "row" }; }
	}
	const view = new Row({ autoRender: false });
	assert.equal( view.el.tagName, "TR" );
	assert.equal( view.el.getAttribute("class"), "row" );
	assert.equal( view.el.getAttribute("role"), "row" );
});

test("attributes may be a function (the Backbone idiom)", () => {
	class Cell extends View {
		get tagName(){ return "td"; }
		attributes(){ return { colspan: 2 }; }
	}
	const view = new Cell({ autoRender: false });
	assert.equal( view.el.tagName, "TD" );
	assert.equal( view.el.getAttribute("colspan"), "2" );
});

test("options win over the subclass declarations, and merge into attributes", () => {
	class Row extends View {
		get tagName(){ return "tr"; }
		get className(){ return "row"; }
		get attributes(){ return { role: "row", title: "declared" }; }
	}
	const view = new Row({
		tagName: "th",
		className: "header",
		attributes: { title: "passed" },
		autoRender: false
	});
	assert.equal( view.el.tagName, "TH" );
	assert.equal( view.el.getAttribute("class"), "header" );
	assert.equal( view.el.getAttribute("role"), "row", "declared attributes survive" );
	assert.equal( view.el.getAttribute("title"), "passed", "passed attributes win" );
});

test("an explicit el still wins over every declaration", () => {
	class Row extends View {
		get tagName(){ return "tr"; }
	}
	const view = new Row({ el: "#main", autoRender: false });
	assert.equal( view.el, dom.document.getElementById("main") );
	assert.equal( view.el.tagName, "DIV" );
});

test("a created element is detached until rendered, and delegates events", () => {
	class Item extends View {
		get tagName(){ return "li"; }
		get events(){ return { "click .go": "onGo" }; }
		onGo(){ this.hits = ( this.hits || 0 ) + 1; }
	}
	const view = new Item({ className: "item", html: `<a class="go">go</a>` });
	assert.equal( view.el.tagName, "LI" );
	assert.equal( view.el.getAttribute("class"), "item" );

	dom.click( view.el.querySelector(".go") );
	assert.equal( view.hits, 1, "delegation works on a constructed element" );
});
