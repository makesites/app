// Template compiler tests — run with: npm test  (node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { Template } from "../dist/app.js";

test("Template: a pluggable compiler overrides the built-in (and options route correctly)", () => {
	const compiler = (markup) => (data) => `[${markup}|${data.x}]`;
	const t = new Template("hello", { compiler, type: "custom" });
	// regression: options must reach this.options (the super({}, options) fix)
	assert.equal(typeof t.options.compiler, "function");
	assert.equal(t.options.type, "custom");
	// the injected compiler is used
	assert.equal(t.get("default")({ x: 9 }), "[hello|9]");
});

test("Template: a CSP-safe compiler (no new Function) works under strict CSP", () => {
	// a trivial {{key}} property interpolator - no eval, no unsafe-eval needed
	const safe = (markup) => (data) => markup.replace(/\{\{(\w+)\}\}/g, (_, k) => String(data[k] ?? ""));
	const t = new Template("Hi {{name}}", { compiler: safe });
	assert.equal(t.get("default")({ name: "Ada" }), "Hi Ada");
});

test("Template: the built-in compiler still escapes interpolated data", () => {
	const t = new Template("<b>${title}</b>");
	assert.equal(t.get("default")({ title: "<x>" }), "<b>&lt;x&gt;</b>");
});
