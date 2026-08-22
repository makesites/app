// listenTo / stopListening tests — run with: npm test  (node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { Model } from "../dist/app.js";

test("listenTo delivers with the listener as context; stopListening removes it", () => {
	const a = new Model();
	const b = new Model();
	let count = 0, ctxOK = false;
	a.listenTo(b, "ping", function () { count++; ctxOK = (this === a); });
	b.trigger("ping");
	assert.equal(count, 1);
	assert.equal(ctxOK, true, "callback runs with the listener (a) as `this`");
	a.stopListening();
	b.trigger("ping");
	assert.equal(count, 1, "no more delivery after stopListening()");
});

test("stopListening(obj) only drops that object's bindings", () => {
	const a = new Model(), b = new Model(), c = new Model();
	let nb = 0, nc = 0;
	a.listenTo(b, "e", () => nb++);
	a.listenTo(c, "e", () => nc++);
	a.stopListening(b);
	b.trigger("e");
	c.trigger("e");
	assert.equal(nb, 0, "b binding removed");
	assert.equal(nc, 1, "c binding intact");
});
