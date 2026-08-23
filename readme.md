# APP()

A lightweight, ES6 client-side application framework — a modernized, largely
dependency-free evolution of [backbone-app](http://github.com/makesites/backbone-app).
It keeps the familiar MV* structure (Models, Collections, Views, Controllers,
Layouts, Templates) while replacing the legacy stack (Backbone, jQuery `$.ajax`,
Underscore, System.js) with native Web APIs: `fetch`, `IntersectionObserver`,
`DOMParser`, `BroadcastChannel`, the History API and ES Modules.

Coming from Backbone? See [Relationship to Backbone.js](#relationship-to-backbonejs)
for what carries over and what is deliberately different.

> **Note:** The core is feature-complete, tested (235 tests) and running in CI.
> See *Status* below for what ships and what is deliberately still open.


## Features

* ES6 class-based architecture (no `extend` shims)
* An **application facade**: `new APP()` composes `events`/`state`/`views`/`router`;
  `await app.ready`
* A decoupled, **cross-tab event bus** (`app.events`, via `BroadcastChannel`)
* Native `fetch()` sync layer — `fetch()` / `save()` / `destroy()` return Promises
* Native `Router` / `History` (pushState & hashchange), with route guards
* `listenTo` / `stopListening` with automatic cleanup on view removal
* Offline-first caching (`localStorage`) with stale-while-revalidate sync
* Authentication `Session` model (sessionStorage → localStorage → cookie fallback)
* `IntersectionObserver`-based view visibility (`visible` / `hidden` events)
* Remote templates via `DOMParser`; a **pluggable compiler** (CSP-safe via injection)
* Composable input mixins: Touch, Mouse, Scroll, Motion, Gamepad, Keys
* `Observable` - make any class an event emitter, no Model required
* `_` - the same utility belt the framework classes use, exported for yours
* **TypeScript declarations** generated from JSDoc, and source maps for both bundles


## Installation

**NPM**

```bash
npm install @makesites/app
```

```javascript
import { APP, Model, View, Controller, Collection } from "@makesites/app";
import { Events, Session } from "@makesites/app";       // bus + session
import { TouchMixin, KeysMixin } from "@makesites/app";  // input mixins
```

**CDN & import maps** (no build step)

```html
<script type="importmap">
  { "imports": { "app": "https://cdn.jsdelivr.net/npm/@makesites/app/dist/app.js" } }
</script>
<script type="module">
  import { APP, Model, View } from "app";
</script>
```

The library also attaches itself to `window.APP` (and `window.app` once
instantiated) for classic script-tag usage.


## Quick start — the APP facade

`new APP()` returns a **facade** whose sub-objects are ready immediately; the
router resolves asynchronously, so `await app.ready` before using `app.router`.

```javascript
import { APP } from "@makesites/app";
import "./app/controllers.js";   // registers APP.Controllers.Default

const app = new APP({ pushState: true });
window.app = app;

app.events.on("cart:add", (item) => badge.update());  // decoupled pub/sub
app.state.online;                                     // device/env state
app.views.add("main", view);                          // view registry

await app.ready;                                      // router now available
app.router.navigate("/home", { trigger: true });
```


## Core API

### Naming

Two conventions run through the whole library:

- **`data` is the payload.** `Model#data` is its attributes, `Collection#data` is
  its models, `View#data` is the model or collection it renders. `attributes` and
  `models` remain as permanent aliases.
- **`defaults` is the default payload for that class.** Attribute defaults on a
  Model; option defaults on a View, Collection or Controller. Each class's
  `defaults` describes the thing that class is about.

### Model & Collection

Observable data with a native `fetch()`-based sync layer.

```javascript
class Book extends Model {
  get defaults(){ return { title: "", read: false }; }   // attribute defaults
  get urlRoot(){ return "/api/books"; }                   // url = urlRoot + "/" + id
  validate(attrs){ if (!attrs.title) return "title required"; }
}

const book = new Book({ id: 1 });
book.on("change:read", (m, read) => console.log("read?", read));
await book.fetch();                 // GET /api/books/1
book.set({ read: true });
console.log(book.hasChanged("read"), book.previous("read"));  // true, false
await book.save();                  // validates, then PUT (or POST when new)
```

`Collection` proxies native array methods to its models
(`map`, `filter`, `reduce`, `find`, `some`, `every`, `pluck`, `where`, ...), keeps
an id/cid index, stays sorted by a `comparator`, and forwards its members' events.

```javascript
class Library extends Collection {
  get model(){ return Book; }                 // members are Books
  get url(){ return "/api/books"; }
  get comparator(){ return "title"; }         // keep sorted by title
}

const library = new Library([{ id: 1, title: "B" }]);
library.on("add", (book) => console.log("added", book.get("title")));
library.on("change", (book) => console.log("a member changed"));
await library.fetch();                         // set()s the response (merge + remove)
library.add({ id: 9, title: "A" });            // deduped by id, inserted in order
library.get(9).set({ read: true });            // by id — fires "change"
library.at(0);                                 // by position
library.remove(9);
```

`get()` resolves an **id** (or a cid, or a model), so it works with the usual
numeric ids; `at()` is the positional accessor.

### View

Organises the DOM and reacts to data. Bindings made with `listen`/`listenTo` are
torn down automatically on `remove()` (no leaks); visibility is tracked natively
via `IntersectionObserver` (`visible` / `hidden` events). Zero jQuery.

A view passed a `model` (or `collection`) binds to it automatically: the default
`bind` option is `"add remove reset change"`, so `render()` re-runs when the data
changes, and the binding is dropped on `remove()`.

```javascript
class BookView extends View {
  render(){
    this.el.innerHTML = `<h2>${this.model.get("title")}</h2>`;
    return this;
  }
}

const view = new BookView({ model: book, el: "#app" });
book.set({ title: "Middlemarch" });   // the view re-renders
view.remove();   // stopListening + undelegate + disconnect observer + detach
```

With no `el`, the view builds its own element from `tagName` (default `div`),
`className`, `id` and `attributes` — as options or as subclass declarations:

```javascript
class BookRow extends View {
  get tagName(){ return "li"; }
  get className(){ return "book"; }
  get attributes(){ return { role: "listitem" }; }
}
new BookRow({ model: book });        // <li class="book" role="listitem">
```

To watch something else, use `listen`/`listenTo` — also torn down by `remove()`.
When you override `initialize()`, call `super.initialize()` so the base setup
(element, template, bindings, visibility observer) still runs:

```javascript
class BookView extends View {
  initialize(){
    super.initialize();
    this.listen(this.collection, "sort", this.render);
  }
}
```

### Controller & Router

`Controller` extends the native `Router`. Declare routes with a `routes` getter
(merged over the built-in routes); guard them by overriding `execute()` and
returning `false` to cancel.

```javascript
class Main extends Controller {
  get routes(){
    return { "": "home", "dashboard": "dashboard" };
  }
  home(){ /* ... */ }
  dashboard(){ /* ... */ }

  // route guard
  execute(callback, args, name){
    if (name === "dashboard" && !this.app.session?.get("auth")) {
      this.navigate("login", { trigger: true });
      return false;                 // cancel the route
    }
    return super.execute(callback, args, name);
  }
}

APP.Controllers.Default = Main;     // the facade picks this up
```

### Observable

Any object can take part in the event system — you don't have to be a Model:

```javascript
import { Observable } from "@makesites/app";

class Player extends Observable {
  play(track){ this.trigger("play", track); }
}

ui.listenTo(player, "play", ui.render);        // torn down by ui.stopListening()
ui.listenToOnce(player, "ready", ui.enable);   // auto-unbinds after firing
```

`Model`, `Collection`, `View`, `Router` and the `Events` bus all extend it, so
`on` / `off` / `once` / `trigger` / `listenTo` / `listenToOnce` / `stopListening`
behave identically everywhere.

### Utilities (`_`)

The helper belt the framework classes use themselves, exported so code extending
them has the same tools. The name is a leftover convention from the Underscore
days — the dependency is long gone and these are hand-written or native.

```javascript
import { _ } from "@makesites/app";

_.extend( target, patch );        // shallow merge, mutates and returns target
_.result( this, "url" );          // resolve a value, getter or method
_.isEqual( a, b );                // value equality (structural for objects)
_.isEmpty( value );               // PHP-style: 0, false, "0" and {} are empty
_.uniqueId( "row" );              // "row-17"
_.bindAll( obj, "onClick" );      // permanently bind methods
_.assignable( obj, "model" );     // would a plain assignment succeed?
```

`_.mixin()` is the extension point for a template compiler:

```javascript
_.mixin({ template: Handlebars.compile });
```

The `Utils` class is exported too, if you want your own instance.

### Events bus

A decoupled, cross-tab publish/subscribe bus (distinct from an object's own
`on`/`trigger`). Publishers and subscribers never reference each other, and
events mirror across tabs of the same origin.

```javascript
// publisher (no reference to any subscriber):
app.events.trigger("slideshow:next", frame);
// subscribers anywhere — same tab or another tab:
app.events.on("slideshow:next", (frame) => caption.show(frame));
```

### Template

Compiles inline markup or fetches remote HTML fragments natively. The default
compiler uses `new Function` (needs the `unsafe-eval` CSP directive); inject your
own compiler to run under strict CSP.

```javascript
const t = new Template("<b>${title}</b>");          // built-in (escapes data)

// strict-CSP / bring-your-own engine:
const t2 = new Template(html, { compiler: Handlebars.compile });
```

Inside the markup you get every top-level key of the data whose name is a valid
identifier, plus `data` / `obj` (the whole payload) and `escape`:

```javascript
// string values are HTML-escaped for you
new Template("<b>${title}</b>");
// anything reached through `data` is raw — escape it yourself
new Template("<ul>${data.map(b => '<li>' + escape(b.title) + '</li>').join('')}</ul>");
```

The **markup** is author-trusted (it is compiled into a template literal, so a
`${…}` in it executes). Inject a `compiler` for untrusted markup or a strict CSP.

### sync

The `fetch()`-based networking function underlying `Model`/`Collection`.
Returns a Promise, still fires `success`/`error` callbacks and `request`/`error`
events, applies an app-wide base URL / credentials / headers (see
`configureSync`), and manually rejects on non-2xx responses.


## Extensions

### Session (authentication)

```javascript
const session = new Session({}, { host: "https://api.example.com" });
session.once("loaded", () => history.start({ pushState: true }));
session.on("change:auth", () => {
  if (!session.get("auth")) app.router.navigate("login", { trigger: true });
});
```

Wire it into the app with `new APP({ session: { host } })` — it becomes
`app.session`, and the controller's `preRoute` guard waits for it before running
protected routes.

### Offline cache

Opt in per model with the `cache` option. Successful reads/writes update
`localStorage`; a failed read transparently falls back to the cached copy.

```javascript
const profile = new Model({ id: 1 }, {
  cache: true,
  cacheOptions: { cache_timestamp: true, cache_exclude: ["token"] }
});
await profile.fetch(); // uses the cache when offline
```

### Input mixins

Six composable mixins, each wrapping any `View`-like class and emitting its own
events:

| mixin | emits | opt-in |
|---|---|---|
| `TouchMixin` | `touchstart` / `touchmove` / `touchend`, tracking swipe direction | automatic on a touch screen (`touch: { monitor: false }` to disable) |
| `MouseMixin` | `mousemove` | `monitorMouse: true` |
| `ScrollMixin` | `scroll`, with direction and position | `monitorScroll: true` |
| `MotionMixin` | `deviceorientation` | `monitorMotion: true` |
| `GamepadMixin` | `gamepad-connect` / `gamepad-disconnect` / `gamepad-update` / `gamepad-buttondown` / `gamepad-buttonup` / `gamepad-axis` | `monitorGamepad: true` |
| `KeysMixin` | `keydown` / `keyup`, plus a declarative `keys` map | `monitorKeys: true` |

```javascript
class Carousel extends TouchMixin(View) {
  initialize(){ super.initialize(); this.on("touchmove", () => { /* ... */ }); }
}

// they compose
class Game extends KeysMixin(GamepadMixin(View)) {
  constructor(o){ super(o); this.keys = { "Escape": "pause", "KeyW": "forward" }; }
  pause(){ /* ... */ }
}
```


## Build & test

```bash
npm run build         # lib/ -> dist/app.js (+ .map), minified bundle, and types/
npm test              # node --test
npm run coverage      # node --test --experimental-test-coverage
npm run lint          # eslint
npm run types         # regenerate types/app.d.ts and type-check a sample consumer
npm run test:browser  # Playwright smoke tests against the built bundles
```

`lib/*.js` are real ES modules; the build bundles the graph from `lib/main.js`
with esbuild — there is no hand-maintained file order. The test suite runs on the
built bundle, so build before testing (CI does). Both bundles ship **source maps**
that resolve back to `lib/*.js`, with accurate line *and* column.

The library ships as **one bundle**, deliberately. Tree-shaking is not a goal
here: the entire optional surface (input mixins, session, cache) is about 3 KB
gzipped, which is not worth the constraints that keeping a library side-effect
free imposes on its design.

If you do want the raw module graph — to bundle it yourself, or to import a
single class — it is published too:

```javascript
import { Model } from "@makesites/app/src";   // lib/main.js, unbundled
```

The shipped library has **no runtime dependencies**. The devDependencies are
`esbuild` (bundle + minify), `typescript` (declarations), `eslint`, `jsdom` (the
view layer is tested against a real DOM) and `@playwright/test` (browser smoke
tests, which need `npx playwright install chromium` and are not part of
`npm test`).

## TypeScript

Declarations are generated from the JSDoc on the module graph and published as
`types/` (one file per module, entry `types/main.d.ts`), so the package works out
of the box:

```typescript
import { Model, Collection } from "@makesites/app";

class Book extends Model {
  get defaults(){ return { title: "", read: false }; }
}
const library = new Collection([{ id: 1 }], { model: Book });
```

Methods that carry JSDoc get real signatures; the rest are `any`. One known
limitation: `Collection`'s `model` is inferred as a property, so TypeScript
rejects `get model(){ ... }` on a subclass (it works at runtime) - pass
`{ model: Book }` instead.


## Status

The core is feature-complete and covered by a test suite (`npm test`), with CI
running build + tests on Node 20 / 22 / 24. No jQuery, Underscore or Backbone
remain in `lib/`.

- **APP facade** — `events` / `state` / `views` / `session` ready synchronously,
  `router` via `await app.ready`.
- **Model** — attribute `defaults`, `validate`, change tracking
  (`previous` / `changedAttributes` / `hasChanged`), `idAttribute`, `urlRoot`.
- **Collection** — smart `set` (add / remove / merge) with id dedup, `comparator`
  and `sort`, `remove` / `reset`, an id+cid index behind `get()`, model-event
  forwarding, and the Underscore-parity aggregators
  (`groupBy` / `countBy` / `sortBy` / `invoke` / `partition` / `min` / `max` / `sample`).
- **View** — `model` / `collection` binding, `tagName`/`className`/`id`/`attributes`,
  delegated `events`, `listenTo` + full teardown on `remove()`,
  `IntersectionObserver` visibility. The observer, the resize registration, the
  template and the state model are all built on demand.
- **Layout** — a `<body>`-level view that registers child views; `remove()` tears
  it down, `removeView( name )` removes one child.
- **Router / History** — pushState & hashchange, route guards via `execute()`.
- **sync** — `AbortController` cancel/timeout, opt-in retry with exponential
  backoff + jitter, an app-wide base URL / credentials / headers.
- **Template** — pluggable compiler (the CSP-safe path), remote fragments.
- **cache / Session** — capability-probed storage that degrades instead of
  throwing when it is absent or blocked.

Subclasses can declare `routes`, `events`, `states`, `defaults`, `model`,
`comparator` and `url` as getters.

### Known limitations

- **`Layout` does not run `View#initialize()`.** It overrides it completely, so a
  Layout has no visibility observer, no automatic data binding and no delegated
  `events` hash — it uses its own `click` handler for link interception. That is
  the long-standing design; it is written down here because it surprises people.
- **`Model#url()` requires `urlRoot`, a `url`, or a parent collection.** With none
  of those it returns `null` and `sync` throws — `autofetch` checks for this, a
  direct `fetch()` does not.
- **TypeScript:** `Collection`'s `model` is inferred as a property, so a subclass
  cannot override it with a getter (TS2611). Pass `{ model: Book }` instead. It
  works at runtime.
- **`window.app`** is still published by the facade. It is how third-party plugins
  detect a running app; replacing it means designing a plugin protocol.

`roadmap.md` records what is left. The architectural pass (§2) is closed: the
View's machinery is lazy rather than split out, the `_` helpers are native inside
an unchanged API, `lib/` is a real ES module graph behind a single bundle, the
naming follows this library's own conventions, and the `parse()` timer is gone.
What remains is a release, the first real CI run of the browser suite, and the
Backbone conveniences listed above.


## Relationship to Backbone.js

APP is not a Backbone fork, a port, or a drop-in replacement — you cannot point it
at a Backbone app and expect it to run. But it would be dishonest to pretend the
resemblance is accidental: **Backbone.js is the single biggest influence on this
library's architecture**, and where its conventions are good they have been kept
deliberately, because they are good — not out of obligation.

If you know Backbone, most of this will already make sense. Where APP departs, it
is a decision, and the reasoning is below.

### What carries over

| | |
|---|---|
| **Events** | `on` / `off` / `once` / `trigger`, `listenTo` / `listenToOnce` / `stopListening`, the `all` catch-all, space-separated names |
| **Model** | `get` / `set` with `change:<attr>`, `defaults`, `validate`, `idAttribute`, `urlRoot`, `previous` / `changedAttributes` / `hasChanged`, `fetch` / `save` / `destroy`, `parse`, `toJSON`, `isNew` |
| **Collection** | smart `set` (add / remove / merge), `comparator` and `sort`, `get` / `at`, `pluck` / `where` / `findWhere`, member-event forwarding, the Underscore-style aggregators |
| **Router** | `:param`, `*splat` and `(optional)` patterns, `navigate`, `execute` as the guard hook, pushState and hashchange |
| **View** | `el`, the declarative `events` hash with real delegation, `render()`, `remove()`, `setElement`, `tagName` / `className` / `id` / `attributes` |
| **sync** | one networking seam every model and collection goes through |

### What is deliberately different

- **`class X extends Model`, not `Model.extend({...})`.** The custom-extend shim
  existed because ES5 had no classes. It does now, so there is nothing to shim.
- **`data` is the payload, everywhere.** `Model#data`, `Collection#data`,
  `View#data`. Backbone says `attributes` and `models`; both are kept as
  permanent aliases, but one word for "the thing this object holds" reads better
  than three. See *Naming* below.
- **`defaults` means "defaults for this class's payload."** Attribute defaults on
  a Model, option defaults on a View, Collection or Controller. Backbone fixes
  `defaults` to attributes; tying one word to one class's idea of a payload is
  more rigid than useful.
- **`Observable`, by inheritance, not `Backbone.Events` as a mixin.** Same API,
  reachable the ES6 way — `class Player extends Observable`.
- **`Events` is a different thing here.** In Backbone it is the observer mixin; in
  APP it is an application-wide pub/sub bus that also crosses browser tabs. The
  observer role belongs to `Observable`.
- **`Controller extends Router`.** The thing that owns your routes is the same
  thing that owns your app logic, rather than two objects you wire together.
- **There is a facade.** `new APP()` composes `events` / `state` / `views` /
  `session` / `router`. Backbone has no equivalent; you assembled it yourself.
- **Batteries are included, not plugged in.** Offline caching, sessions,
  templating, view states, viewport visibility and input mixins ship in the box.
  Backbone left all of these to plugins. They are opt-in per instance and, as of
  the lazy-machinery pass, cost nothing when unused.
- **No jQuery, so no `this.$el` or `this.$()`.** `this.el` is a real DOM element;
  use `querySelector` on it.
- **`sync` returns a Promise**, not a jqXHR — with `AbortController`
  cancel/timeout and opt-in retry. There is no `emulateHTTP` / `emulateJSON`.

### Conveniences Backbone has and APP does not (yet)

`Model`: `escape`, `unset`, `clone`, `isValid`, `keys` / `values` / `pick` / `omit`.
`Collection`: `push` / `pop` / `shift` / `unshift`, `first` / `last` / `initial` /
`rest`, `create`, `clone`, `modelId`, `indexBy`, `without`, `shuffle`.
`View`: `delegate` / `undelegate` (the single-binding variants).

None are hard; they simply have not been needed yet. Ask if one is blocking you.

## Credits

Created by Makis Tracend ( [@tracend](http://github.com/tracend) )

Distributed through [Makesites.org](http://makesites.org)


## License

Released under the [MPL v2.0](http://www.mozilla.org/MPL/2.0/) & [AGPL v3.0](http://www.gnu.org/licenses/agpl-3.0.html)
