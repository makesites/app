// A stand-in for a TypeScript consumer of the published package.
//
// `npm run types` type-checks this file against the generated types/app.d.ts,
// resolved through the package's own `exports` map — so it verifies the whole
// chain a real user hits: package name -> exports condition -> declarations.
// It is never executed; it exists to fail the build if the types stop working.
import {
	APP, Observable, Model, Collection, View, Router, Events, Template, sync, _, Utils
} from "@makesites/app";

// --- Model ---------------------------------------------------------------
class Book extends Model {
	get defaults(){ return { title: "", read: false }; }
	get urlRoot(){ return "/api/books"; }
}

const book = new Book({ id: 1, title: "Middlemarch" });
const title: string = book.get("title");
book.set({ read: true });
book.on("change:read", (model, read) => console.log(model, read));
const changed: boolean = book.hasChanged("read");
void book.fetch();
void book.save();

// --- Collection ----------------------------------------------------------
class Library extends Collection {
	// KNOWN LIMITATION: the declarations infer `model` as a *property* (the
	// constructor assigns it), so TypeScript rejects overriding it with an
	// accessor — even though this is the canonical Backbone declaration and works
	// at runtime (commit 43). TS users should pass `{ model: Book }` instead;
	// see the `library2` line below.
	//
	// The marker is deliberate: if the underlying shape is ever changed to an
	// accessor pair, `@ts-expect-error` becomes unused and this file starts
	// failing, which is the reminder to delete these lines.
	// @ts-expect-error TS2611 - property overridden as accessor
	get model(){ return Book; }
	get comparator(){ return "title"; }
}

// the form TypeScript consumers should use today
const library2 = new Collection([{ id: 1, title: "B" }], { model: Book });
void library2;

const library = new Library([{ id: 1, title: "B" }]);
library.add({ id: 9, title: "A" });
const found = library.get(9);
const titles = library.pluck("title");
const grouped = library.groupBy("read");
library.remove(9);

// --- View ----------------------------------------------------------------
class BookView extends View {
	render(){
		this.el.innerHTML = "<h2>" + this.model.get("title") + "</h2>";
		return this;
	}
}
const view = new BookView({ model: book, el: "#app" });
view.remove();

// --- facade, bus, router, sync -------------------------------------------
const app = new APP({ pushState: true });
app.events.on("cart:add", (item: unknown) => console.log(item));
void app.ready;

const bus = new Events("shop");
bus.trigger("slideshow:next", 3);

const router: Router = new Router({});
router.navigate("/home", { trigger: true });

const template = new Template("<b>${title}</b>");
void sync("read", book, { retry: 2, timeout: 5000 });

// --- Observable ----------------------------------------------------------
class Player extends Observable {
	play( track: string ){ this.trigger("play", track); }
}
const player = new Player();
player.on("play", (track) => console.log(track));
player.listenToOnce(book, "sync", () => console.log("first sync only"));

// --- utilities -----------------------------------------------------------
const merged: Object = _.extend({}, { a: 1 }, { b: 2 });
const resolved = _.result(book, "url");
const empty: boolean = _.isEmpty({});
const cid: string = _.uniqueId("row");
const ownUtils = new Utils();
ownUtils.mixin({ template: (markup: string) => () => markup });

export { title, changed, found, titles, grouped, view, app, bus, router, template, player, merged, resolved, empty, cid, ownUtils };
