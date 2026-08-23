// Declarative subclass members (getters) — run with: npm test
//
// Commit 27 made routes/events/states declarable as getters by resolving them
// instead of assigning them. These cover the names that were still assigned in a
// constructor and therefore still threw
// "TypeError: Cannot set property X ... which has only a getter".
import { test } from "node:test";
import assert from "node:assert/strict";
import { mountDOM } from "./helpers/dom.js";
import { Model, Collection, Controller, View } from "../dist/app.js";

class Book extends Model {
	get defaults(){ return { read: false }; }
}

test("Collection: `get model()` — the canonical Backbone declaration", () => {
	class Library extends Collection {
		get model(){ return Book; }
	}
	const library = new Library([{ id: 1, title: "B" }]);
	assert.equal(library.model, Book);
	assert.ok(library.get(1) instanceof Book, "members are built from the declared class");
	assert.equal(library.get(1).get("read"), false, "the model's own defaults applied");
});

test("Collection: an options.model still wins over the base default", () => {
	const collection = new Collection([{ id: 1 }], { model: Book });
	assert.ok(collection.get(1) instanceof Book);
});

test("Collection: `get defaults()` supplies option defaults", () => {
	class Paged extends Collection {
		get defaults(){ return { pageSize: 25 }; }
	}
	const collection = new Paged();
	assert.equal(collection.options.pageSize, 25);
	assert.equal(collection.options._synced, false, "framework built-ins still merge underneath");
	assert.equal(collection.options.cache, false);
});

test("Collection: constructor options win over a subclass defaults", () => {
	class Paged extends Collection {
		get defaults(){ return { pageSize: 25 }; }
	}
	assert.equal(new Paged(null, { pageSize: 100 }).options.pageSize, 100);
});

test("Controller: `get defaults()` supplies app config defaults", () => {
	class Main extends Controller {
		get defaults(){ return { autostart: false, p404: "/oops" }; }
	}
	const controller = new Main();
	assert.equal(controller.options.autostart, false);
	assert.equal(controller.options.p404, "/oops");
	assert.equal(controller.options.api, false, "framework built-ins still merge underneath");
});

test("Controller: constructor options win over a subclass defaults", () => {
	class Main extends Controller {
		get defaults(){ return { p404: "/oops" }; }
	}
	assert.equal(new Main({ autostart: false, p404: "/nope" }).options.p404, "/nope");
});

test("View: `get url()` is not overwritten by the internal resolver", () => {
	const dom = mountDOM(`<div id="main"></div>`);
	// the url makes the View build a Template, which starts a fetch we don't care
	// about here - stub it so the suite output stays clean
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => ({ text: async () => "" });
	try {
		class Remote extends View {
			get url(){ return "/templates/remote.html"; }
		}
		const view = new Remote({ el: "#main", autoRender: false });
		assert.equal(view.url, "/templates/remote.html", "the declaration survives construction");
		assert.equal(view.options.url, "/templates/remote.html", "and is picked up as the template url");
	} finally {
		if( originalFetch ) globalThis.fetch = originalFetch; else delete globalThis.fetch;
		dom.restore();
	}
});

test("the whole declarative surface constructs without throwing", () => {
	const dom = mountDOM(`<div id="main"></div>`);
	try {
		class Panel extends View {
			get defaults(){ return { autoRender: false }; }
			get events(){ return { "click .btn": "onBtn" }; }
			get states(){ return { "scroll": "_scroll" }; }
			onBtn(){}
		}
		class Library extends Collection {
			get model(){ return Book; }
			get defaults(){ return { cache: false }; }
			get comparator(){ return "title"; }
		}
		class Main extends Controller {
			get defaults(){ return { autostart: false }; }
			get routes(){ return { "books": "books" }; }
			books(){}
		}
		assert.ok(new Panel({ el: "#main" }));
		assert.ok(new Library([{ id: 2, title: "A" }, { id: 1, title: "Z" }]));
		assert.ok(new Main());
		assert.deepEqual(new Library([{ id: 2, title: "Z" }, { id: 1, title: "A" }]).pluck("title"), ["A", "Z"]);
	} finally {
		dom.restore();
	}
});
