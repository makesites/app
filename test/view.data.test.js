// View data binding + element identity — run with: npm test
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mountDOM } from "./helpers/dom.js";
import { View, Model, Collection } from "../dist/app.js";

let dom;
beforeEach(() => { dom = mountDOM(`<div id="main">original</div>`); });
afterEach(() => { dom.restore(); dom = null; });

test("new View({ model }) assigns this.model and binds it", () => {
	const model = new Model({ name: "Ada" });
	class Profile extends View {
		render(){ this.el.innerHTML = `<h2>${this.model.get("name")}</h2>`; return this; }
	}
	const view = new Profile({ el: "#main", model });

	// regression: `model` was accepted but never assigned, so this.model was
	// undefined and the documented render() above threw
	assert.equal(view.model, model);
	assert.equal(view.data, model, "data resolves to the model");
	assert.equal(view.options.data, true, "the data flag is set");
	assert.equal(view.el.innerHTML, "<h2>Ada</h2>");

	// the default `bind` includes "change", so the view re-renders
	model.set({ name: "Grace" });
	assert.equal(view.el.innerHTML, "<h2>Grace</h2>");
});

test("new View({ collection }) assigns this.collection", () => {
	const collection = new Collection([{ id: 1 }]);
	// autoRender is off here on purpose: the built-in template compiler cannot
	// consume a collection's array toJSON() yet (see the Template commit)
	const view = new View({ el: "#main", collection, autoRender: false });
	assert.equal(view.collection, collection);
	assert.equal(view.data, collection);
});

test("an explicit data option still wins over model/collection", () => {
	const model = new Model({ a: 1 });
	const data = new Model({ b: 2 });
	const view = new View({ el: "#main", model, data, html: "<i>x</i>" });
	assert.equal(view.model, model);
	assert.equal(view.data, data);
});

test("a subclass `get model()` is not clobbered (assigning to a getter throws)", () => {
	const declared = new Model({ id: "declared" });
	class Fixed extends View {
		get model(){ return declared; }
	}
	const view = new Fixed({ el: "#main", model: new Model({ id: "passed" }), html: "<i>x</i>" });
	assert.equal(view.model, declared, "the subclass accessor wins and nothing throws");
});

test("the element keeps its identity and place in the document", () => {
	const view = new View({ el: "#main", html: "<b>rendered</b>" });

	// regression: initialize() called unbind(), which replaced this.el in the
	// document with a clone of itself. this.el then pointed at the detached
	// original, _inDOM() re-appended it to the end of <body>, and the page ended
	// up with two #main elements - an empty one in place and the real one last.
	assert.equal(dom.document.querySelector("#main"), view.el, "same node, still mounted");
	assert.equal(dom.document.querySelectorAll("#main").length, 1, "no duplicate element");
	assert.equal(view.el.innerHTML, "<b>rendered</b>");
	assert.equal(dom.document.body.children.length, 1, "nothing appended to the end of body");
});

test("unbind() drops the delegated listeners without touching the element", () => {
	class Panel extends View {
		get events(){ return { "click .btn": "onBtn" }; }
		onBtn(){ this.hits = ( this.hits || 0 ) + 1; }
	}
	const view = new Panel({ el: "#main", html: `<button class="btn">go</button>` });
	dom.click( view.el.querySelector(".btn") );
	assert.equal(view.hits, 1);

	view.unbind();
	assert.equal(dom.document.querySelector("#main"), view.el, "the element survives unbind()");
	dom.click( view.el.querySelector(".btn") );
	assert.equal(view.hits, 1, "the delegated listener is gone");
});

test("unbind(type) only drops that event type", () => {
	class Panel extends View {
		get events(){ return { "click .btn": "onClick", "mouseover .btn": "onHover" }; }
		onClick(){ this.clicks = ( this.clicks || 0 ) + 1; }
		onHover(){ this.hovers = ( this.hovers || 0 ) + 1; }
	}
	const view = new Panel({ el: "#main", html: `<button class="btn">go</button>` });
	view.unbind("mouseover");

	dom.click( view.el.querySelector(".btn") );
	assert.equal(view.clicks, 1, "click still delegated");
	view.el.querySelector(".btn").dispatchEvent(
		new dom.window.MouseEvent("mouseover", { bubbles: true })
	);
	assert.equal(view.hovers, undefined, "mouseover was unbound");
});

test("a data-only view with no markup neither blanks nor paints 'undefined'", () => {
	const model = new Model({ name: "Ada" });
	const view = new View({ el: "#main", model });
	assert.equal(view.el.innerHTML, "original", "existing content is left alone");
});
