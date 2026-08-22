// delegateEvents (native delegation) — run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { Model } from "../dist/app.js";

// minimal element: an EventTarget that also answers contains()
function makeEl(){
	const el = new EventTarget();
	el.contains = () => true;
	return el;
}
// a click whose target.closest(sel) matches only `matchSel`
function click( matchSel ){
	const e = new Event("click");
	Object.defineProperty(e, "target", {
		configurable: true,
		value: { closest: (sel) => (sel === matchSel ? {} : null) }
	});
	return e;
}

test("delegateEvents: a REAL event fires the mapped handler (regression for the phantom-type bug)", () => {
	const m = new Model();
	m.el = makeEl();
	let hits = 0;
	m.onBtn = () => hits++;
	m.events = { "click .btn": "onBtn" };
	m.delegateEvents();
	m.el.dispatchEvent( click(".btn") );          // a real "click" matching the selector
	assert.equal(hits, 1);
});

test("delegateEvents: non-matching targets don't fire; undelegate removes it", () => {
	const m = new Model();
	m.el = makeEl();
	let hits = 0;
	m.onBtn = () => hits++;
	m.events = { "click .btn": "onBtn" };
	m.delegateEvents();
	m.el.dispatchEvent( click(".other") );
	assert.equal(hits, 0, "target outside the selector is ignored");
	m.el.dispatchEvent( click(".btn") );
	assert.equal(hits, 1);
	m.undelegateEvents();
	m.el.dispatchEvent( click(".btn") );
	assert.equal(hits, 1, "undelegateEvents removed the listener");
});

test("delegateEvents: a selector-less binding fires on the root element", () => {
	const m = new Model();
	m.el = makeEl();
	let hits = 0;
	m.onAny = () => hits++;
	m.events = { "click": "onAny" };
	m.delegateEvents();
	m.el.dispatchEvent( click(".whatever") );
	assert.equal(hits, 1);
});
