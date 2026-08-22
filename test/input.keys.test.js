// KeysMixin unit tests — run with: npm test  (node --test)
// Uses Node's built-in EventTarget/Event as a stand-in DOM element, so no jsdom
// is required. Run `npm run build` first so dist/app.js is current.
import { test } from "node:test";
import assert from "node:assert/strict";
import { KeysMixin } from "../dist/app.js";

// A minimal View-like base: exposes el (an EventTarget), options and trigger().
class StubView {
	constructor(options = {}) {
		this.options = options;
		this.el = new EventTarget();
	}
	trigger() {}
}

class ModalView extends KeysMixin(StubView) {
	get keys() {
		return {
			"Escape": "closeModal", // mapped by event.key
			"KeyW": "moveForward"   // mapped by event.code
		};
	}
	constructor(options) {
		super(options);
		this.closed = 0;
		this.moved = 0;
	}
	closeModal() { this.closed++; }
	moveForward() { this.moved++; }
}

function key(type, props) {
	const e = new Event(type);
	Object.assign(e, props);
	return e;
}

test("KeysMixin: routes event.key to the mapped method", () => {
	const view = new ModalView({ monitorKeys: true });
	view.el.dispatchEvent(key("keydown", { key: "Escape", code: "Escape" }));
	assert.equal(view.closed, 1);
});

test("KeysMixin: routes physical event.code to the mapped method", () => {
	const view = new ModalView({ monitorKeys: true });
	view.el.dispatchEvent(key("keydown", { key: "w", code: "KeyW" }));
	assert.equal(view.moved, 1);
});

test("KeysMixin: ignores unmapped keys without throwing", () => {
	const view = new ModalView({ monitorKeys: true });
	assert.doesNotThrow(() => view.el.dispatchEvent(key("keydown", { key: " ", code: "Space" })));
	assert.equal(view.closed, 0);
	assert.equal(view.moved, 0);
});

test("KeysMixin: tracks isKeyHeld across keydown/keyup", () => {
	const view = new ModalView({ monitorKeys: true });
	view.el.dispatchEvent(key("keydown", { code: "KeyW" }));
	assert.equal(view.isKeyHeld("KeyW"), true);
	view.el.dispatchEvent(key("keyup", { code: "KeyW" }));
	assert.equal(view.isKeyHeld("KeyW"), false);
});
