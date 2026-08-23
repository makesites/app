// Template: data shapes + a single initialisation — run with: npm test
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mountDOM } from "./helpers/dom.js";
import { Template, Collection, View } from "../dist/app.js";

afterEach(() => { delete globalThis.fetch; });

test("array data renders through `data` instead of throwing", () => {
	const collection = new Collection([{ id: 1, title: "A" }, { id: 2, title: "B" }]);
	const template = new Template("<ul>${data.map(function(b){ return '<li>' + escape(b.title) + '</li>'; }).join('')}</ul>");
	// regression: Object.keys(array) is ["0","1"], and new Function("0","1", …)
	// threw `SyntaxError: Unexpected number` on every render of a collection
	const html = template.get("default")( collection.toJSON() );
	assert.equal(html, "<ul><li>A</li><li>B</li></ul>");
});

test("keys that are not valid identifiers stay reachable via data/obj", () => {
	const template = new Template("<b>${data['first-name']}</b> ${obj.ok}");
	const html = template.get("default")({ "first-name": "Ada", ok: "yes" });
	assert.equal(html, "<b>Ada</b> yes");
});

test("a reserved word as a key does not break compilation", () => {
	// new Function("class", …) is a SyntaxError, so `class` can only be reached
	// through the payload
	const template = new Template("<i>${data.class}</i>");
	assert.equal(template.get("default")({ class: "warning" }), "<i>warning</i>");
});

test("named interpolation and escaping still work", () => {
	const template = new Template("<b>${title}</b>");
	assert.equal(template.get("default")({ title: "hi" }), "<b>hi</b>");
	assert.equal(
		template.get("default")({ title: "<script>x</script>" }),
		"<b>&lt;script&gt;x&lt;/script&gt;</b>",
		"string values are still HTML-escaped"
	);
});

test("the compiled renderer is reused across renders of the same shape", () => {
	const template = new Template("<b>${title}</b>");
	const render = template.get("default");
	assert.equal(render({ title: "one" }), "<b>one</b>");
	assert.equal(render({ title: "two" }), "<b>two</b>");
	assert.equal(render({ title: "three", extra: 1 }), "<b>three</b>", "a new shape compiles too");
});

test("a remote template is fetched exactly once", async () => {
	const dom = mountDOM("");
	try {
		let calls = 0;
		globalThis.fetch = async ( url ) => {
			calls++;
			return { text: async () => `<template id="row"><b>${"$"}{title}</b></template>` };
		};
		const template = new Template(null, { url: "/templates/row.html" });
		await new Promise((r) => setTimeout(r, 10));
		// regression: initialize() ran twice (once from Model's constructor, once
		// from Template's), so the remote file was requested twice and "loaded"
		// fired twice
		assert.equal(calls, 1);
		assert.equal(typeof template.get("row"), "function");
	} finally {
		dom.restore();
	}
});

test("initialize() is the subclass hook and runs once", () => {
	let calls = 0;
	class Custom extends Template {
		initialize(){ calls++; super.initialize(); }
	}
	new Custom("<b>${title}</b>");
	assert.equal(calls, 1);
});

test("a collection-backed View renders through the built-in compiler", () => {
	const dom = mountDOM(`<div id="main"></div>`);
	try {
		const collection = new Collection([{ id: 1, title: "A" }, { id: 2, title: "B" }]);
		const view = new View({
			el: "#main",
			collection,
			html: "<ul>${data.map(function(b){ return '<li>' + escape(b.title) + '</li>'; }).join('')}</ul>"
		});
		assert.equal(view.el.innerHTML, "<ul><li>A</li><li>B</li></ul>");
	} finally {
		dom.restore();
	}
});
