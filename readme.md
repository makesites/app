# APP()

A lightweight, ES6 client-side application framework — a modernized, largely
dependency-free evolution of [backbone-app](http://github.com/makesites/backbone-app).
It keeps the familiar MV* structure (Models, Collections, Views, Controllers,
Layouts, Templates) while replacing the legacy stack (Backbone, jQuery `$.ajax`,
Underscore, System.js) with native Web APIs: `fetch`, `IntersectionObserver`,
`DOMParser`, the History API and ES Modules.

> **Note:** Still evolving toward a production-ready release. See *Status* below.


## Features

* ES6 class-based architecture (no `extend` shims)
* MVC: `Model`, `Collection`, `View`, `Controller`, `Layout`, `Template`
* Native `fetch()` sync layer — `fetch()` / `save()` / `destroy()` return Promises
* Native `Router` / `History` (pushState & hashchange), with route guards
* Offline-first caching (`localStorage`) with stale-while-revalidate sync
* Authentication `Session` model (sessionStorage → localStorage → cookie fallback)
* `IntersectionObserver`-based view visibility (`visible` / `hidden` events)
* Remote templates via `DOMParser` (HTML fragments / `<template>` tags)
* Composable input mixins: Touch, Mouse, Scroll, Motion, Gamepad, Keys
* Handlebars-compatible `{{moustache}}` template compiler (optional)


## Installation

**NPM**

```bash
npm install @makesites/app
```

```javascript
import { APP, Model, View, Controller, Collection } from "@makesites/app";
import { Session } from "@makesites/app";              // opt-in extension
import { TouchMixin, KeysMixin } from "@makesites/app"; // input mixins
```

**CDN & import maps** (no build step)

```html
<script type="importmap">
  {
    "imports": {
      "app": "https://cdn.jsdelivr.net/npm/@makesites/app/dist/app.js"
    }
  }
</script>
<script type="module">
  import { APP, Model, View } from "app";
</script>
```

The library also attaches itself to `window.APP` for classic script-tag usage.


## Core API

### Model & Collection

Observable data with a native `fetch()`-based sync layer.

```javascript
class Book extends Model {
  get url(){ return "/api/books/" + this.get("id"); }
}

const book = new Book({ id: 1 });
await book.fetch();                 // GET, returns a Promise
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

Organises the DOM and reacts to data. Visibility is tracked natively via
`IntersectionObserver` (`visible` / `hidden` events); zero jQuery.

```javascript
class BookView extends View {
  get events(){ return { "click .buy": "buy" }; }

  initialize(){
    this.listen(this.model, "change", this.render);
  }

  buy(e){ /* ... */ }
}

const view = new BookView({ model: book, el: "#app" });
view.render();
```

### Controller & Router

`Controller` extends the native `Router`, mapping URL fragments to methods and
starting the `history` monitor. Override `execute()` to guard routes.

```javascript
class Main extends Controller {
  get routes(){
    return {
      "": "home",
      "books/:id": "showBook",
      "*path": "_404"
    };
  }
  home(){ /* ... */ }
  showBook(id){ /* ... */ }
}

new Main({ autostart: true, pushState: true });
```

### Template

Compiles inline markup or fetches remote HTML fragments natively.

```javascript
const tmpl = new Template(null, { url: "/templates/books.html" });
tmpl.bind("loaded", () => console.log(tmpl.get("default")));
```

### sync

The `fetch()`-based networking function underlying `Model`/`Collection`.
Returns a Promise, still fires `success`/`error` callbacks and `request`/`error`
events, and manually rejects on non-2xx responses.


## Extensions

### Session (authentication)

```javascript
const session = new Session({}, { host: "https://api.example.com" });
session.once("loaded", () => history.start({ pushState: true }));
session.on("change:auth", () => {
  if (!session.get("auth")) router.navigate("login", { trigger: true });
});
```

Wire it into a `Controller` with `new Controller({ session: { host } })` — the
`preRoute` guard waits for the session before running protected routes.

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
  get keys(){ return { "Escape": "pause", "KeyW": "forward" }; }
  pause(){ /* ... */ }
}
```


## Build

The distributable is concatenated from `lib/` into `dist/` via Node.js:

```bash
$ npm run build      # or: node build
```

You will find the compiled `dist/app.js` and `dist/app.min.js`.


## Status

The core (Model, Collection, View, Controller/Router, Template, sync, cache,
session, input) has been modernized off Backbone/jQuery/Underscore. A few areas
still use jQuery and are being migrated: `Layout`, `APP.ready()` and
`Controller._ajaxPrefilter`.


## Credits

Created by Makis Tracend ( [@tracend](http://github.com/tracend) )

Distributed through [Makesites.org](http://makesites.org)


## License

Released under the [MPL v2.0](http://www.mozilla.org/MPL/2.0/) & [AGPL v3.0](http://www.gnu.org/licenses/agpl-3.0.html)
