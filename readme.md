# APP()

A lightweight, ES6 client-side application framework — a modernized, largely
dependency-free evolution of [backbone-app](http://github.com/makesites/backbone-app).
It keeps the familiar MV* structure (Models, Collections, Views, Controllers,
Layouts, Templates) while replacing the legacy stack (Backbone, jQuery `$.ajax`,
Underscore, System.js) with native Web APIs: `fetch`, `IntersectionObserver`,
`DOMParser`, `BroadcastChannel`, the History API and ES Modules.

> **Note:** Approaching production-readiness; a test suite ships with the repo.
> See *Status* below for the remaining rough edges.


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

### Model & Collection

Observable data with a native `fetch()`-based sync layer.

```javascript
class Book extends Model {
  get url(){ return "/api/books/" + this.get("id"); }
}

const book = new Book({ id: 1 });
await book.fetch();                 // GET, returns a Promise
book.on("change:title", (m, v) => console.log("new title:", v));
book.set("title", "A Modern JS Guide");
await book.save();                  // POST/PUT depending on isNew()
```

`Collection` proxies native array methods to its models
(`map`, `filter`, `reduce`, `find`, `some`, `every`, `pluck`, `where`, ...):

```javascript
class Library extends Collection {
  get url(){ return "/api/books"; }
}

const library = new Library();
await library.fetch();
const titles = library.pluck("title");
const active = library.filter(book => book.get("active"));
```

### View

Organises the DOM and reacts to data. Bindings made with `listen`/`listenTo` are
torn down automatically on `remove()` (no leaks); visibility is tracked natively
via `IntersectionObserver` (`visible` / `hidden` events). Zero jQuery.

```javascript
class BookView extends View {
  initialize(){
    // auto-removed when the view is remove()d
    this.listen(this.model, "change", this.render);
  }
  render(){
    this.el.innerHTML = `<h2>${this.model.get("title")}</h2>`;
    return this;
  }
}

const view = new BookView({ model: book, el: "#app" });
view.remove();   // stopListening + disconnect observer + detach from DOM
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

Compose over any `View`-like class:

```javascript
class Carousel extends TouchMixin(View) {
  initialize(){ this.on("touchmove", () => { /* ... */ }); }
}

class Game extends KeysMixin(GamepadMixin(View)) {
  constructor(o){ super(o); this.keys = { "Escape": "pause", "KeyW": "forward" }; }
  pause(){ /* ... */ }
}
```


## Build & test

```bash
npm run build      # concatenates lib/ -> dist/app.js and minifies -> dist/app.min.js
npm test           # node --test (no test dependencies)
```

The concatenation manifest (dependency order) lives in `build/index.js`.


## Status

The core — the APP facade, Model, Collection, View (with `listenTo` cleanup),
Controller/Router, the Events bus, Template (pluggable compiler), `sync`, cache,
`Session`, `Layout` and the input mixins — is modernized off
Backbone/jQuery/Underscore and covered by a test suite. No jQuery, Underscore or
Backbone remain in `lib/`.

Known rough edges (on the roadmap):

* Subclass `routes` / `events` / `states` getters now work; a `get defaults()` on a
  **Model** (attribute defaults) is the remaining one — landing next.
* Model completeness (attribute defaults, validation hooks,
  `previous()`/`changedAttributes()`) and Collection completeness (comparator/sort,
  `remove`, smart `set`/dedup) plus `sync` cancellation (`AbortController`) are
  still to come.


## Credits

Created by Makis Tracend ( [@tracend](http://github.com/tracend) )

Distributed through [Makesites.org](http://makesites.org)


## License

Released under the [MPL v2.0](http://www.mozilla.org/MPL/2.0/) & [AGPL v3.0](http://www.gnu.org/licenses/agpl-3.0.html)
