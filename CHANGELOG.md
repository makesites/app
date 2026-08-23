# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
the project aims to follow [Semantic Versioning](https://semver.org/). While the
version is below 1.0.0, a **minor** bump may carry breaking changes; those are
always listed under *Breaking* below.

## [Unreleased]

Corrective work following an independent review of the 0.7.0 series, then the
distribution and convention passes.

Roadmap §2 was revised rather than executed as originally written: tree-shaking
was dropped as a goal (the whole optional surface is ~3.3 KB gzipped, not worth
the architectural constraints), the View split was replaced by making its
machinery lazy (same benefit, no API change), and the Backbone-conformance
renames were dropped in favour of the library's own `data` / `defaults`
conventions. Real ES modules landed last — for an explicit dependency graph,
still shipping a single bundle.

### Breaking

- **`Collection#get()` resolves ids before array positions.** An integer is now
  looked up in the id index first and only falls back to a positional lookup.
  This is the point of the fix — with the usual numeric ids, `get(9)` previously
  returned `data[9]` and the id index was unreachable. Use `at(n)` for positional
  access; it is unchanged and was always the documented form.
- **`unbind()` removes only the listeners this object registered.** It used to
  "remove all listeners" by replacing `this.el` with a clone of itself, which
  detached the element from the document. Nothing could depend on the old
  behaviour safely.
- **`Collection#get()` returns `null` (never `undefined`) when nothing matches**,
  honouring its documented `?Model` contract.

### Added

- **`Model#data`** — the payload under the library's `data` convention
  (`Collection#data`, `View#data`). `attributes` remains a permanent alias.
- **A "Relationship to Backbone.js" section** in the README: what carries over,
  what is deliberately different and why, and which Backbone conveniences are not
  implemented yet.
- **TypeScript declarations.** `types/app.d.ts` is generated from the JSDoc and
  shipped; `npm run types` regenerates it and type-checks a sample consumer that
  imports by package name, so the whole resolution chain is covered.
- **Source maps** for both bundles, resolving to `lib/*.js` with accurate line
  and column — a minified stack trace names the original source.
- **`Observable`** is exported — the event system on its own, so any class can
  emit without pretending to be a `Model` (the role `Backbone.Events` fills).
- **`listenToOnce( obj, name, callback )`** on the event API.
- **View element creation**: `tagName`, `className`, `id` and `attributes` are
  honoured, as options or subclass declarations. Previously ignored.
- **Subclass declarations** now work for `defaults` on `Collection` and
  `Controller`, `model` on `Collection` (Backbone's canonical form) and `url` on
  `View`, completing the "resolve, don't assign" lifecycle.
- **A real DOM test harness** (jsdom) and the first coverage of `View` and
  `Layout` — about a quarter of the library previously had none.
- **A browser smoke suite** (Playwright) covering the shipped bundles, a real
  `IntersectionObserver`, cross-tab `BroadcastChannel` and real History
  navigation.
- **ESLint** flat config, replacing a `jshint` dependency that was never wired to
  a script and cannot parse the source.
- `npm run lint`, `npm run types`, `npm run test:browser`; CI jobs for each.

### Changed

- **`lib/` is a real ES module graph**, bundled with esbuild instead of
  concatenated into a shared scope from a hand-ordered manifest. The library
  still ships as a single bundle; the win is an explicit dependency graph, not
  bytes. `lib/main.js` is now a real entry module, published and exported as
  `@makesites/app/src`, and declarations are generated from the source rather
  than the bundle (so the class hierarchy survives). `terser` is no longer a
  dependency.
- **View machinery is built on demand.** The IntersectionObserver, the resize
  registration, the `Template` and the state `Model` are no longer created up
  front. Measured on 500 list rows: construction 23.4 ms → 10.7 ms, 500
  observers → 0, 500 window resize listeners → 1 (shared), 500 unused Templates
  → 0. No API change.
- **`_` helper internals are native** where measured faster (`extend` via
  `Object.assign`, 1.34×; `isEmpty` inlined, 1.62×). The method set and
  signatures are unchanged. `each` was deliberately left alone — the "obvious"
  rewrite measured 4.3× slower.
- **`View#options.data` is now `options.hasData`.** The derived flag no longer
  overwrites the option the caller passes a model or collection in.
- **`"fetch"` is emitted by `fetch()`, synchronously**, instead of by a 200 ms
  `setTimeout` inside `parse()`. `save()` no longer emits it.

### Fixed

- `_.bindAll` dropped every argument passed to a bound method
  (`greet("Ada","!")` → `"hi undefinedundefined"`).
- `Collection#set()` deduplicates ids **within a single call** — `add([{id:1},{id:1}])`
  produced two members.
- `Model#isOnline()` / `Collection#isOnline()` threw `ReferenceError` when no app
  had been instantiated.
- `autofetch` threw out of the constructor when no url resolved, and no longer
  leaves a rejected promise unhandled.
- `View` honours the `model` and `collection` options — they were accepted but
  never assigned, so `this.model` was always `undefined` and the automatic data
  binding never happened.
- `View#initialize()` no longer detaches its own element from the document.
- `View#_findContainer()` uses a `renderTarget` found inside the element (it was
  always discarded) and no longer throws when the selector matches nothing.
- `View#remove()` removes its `resize` listener (it never could), cancels a
  pending debounce, and undelegates DOM events; the resize debounce actually
  debounces.
- Storage is probed for capability rather than existence, so `cache: true` works
  under SSR and in browsers with site data blocked; `Session` falls back to an
  in-memory store.
- The template compiler renders array data (any collection) instead of throwing
  `SyntaxError`, compiles once per data shape instead of on every render, and
  `Template#initialize()` runs once — remote templates were fetched twice.
- Several JSDoc defects that produced broken or wrong declarations: Closure-style
  function types, optional parameters emitted as required, and `trigger()`
  dropping its rest arguments.
- Packaging: the `./src` export pointed at the build template (not valid
  JavaScript), `engines` claimed Node 10, and `npm run build` failed after
  applying the patch archives because it relied on an executable bit that zip
  extraction does not preserve.
- Documentation and examples: several examples could never have run (an ES module
  loaded as a classic script, missing files, server-absolute paths), and the
  README listed shipped features as outstanding. A test now validates every
  example.

## [0.7.0]

The modernization series: `@makesites/app` off Backbone, jQuery and Underscore
and onto native Web APIs.

### Added

- A native `fetch()` sync layer with `AbortController` cancel/timeout and opt-in
  retry with exponential backoff.
- A native `Router` / `History` engine (pushState and hashchange) with route
  guards via `execute()`.
- The `APP` facade: `new APP()` returns synchronously with `events`, `state`,
  `views` and `session`; the router resolves via `await app.ready`.
- `Events` as an application-wide pub/sub bus that delivers in-page and mirrors
  across tabs via `BroadcastChannel`.
- `listenTo` / `stopListening` with automatic cleanup on view removal.
- Model completeness: attribute `defaults`, `validate`, change tracking,
  `idAttribute`, `urlRoot`.
- Collection completeness: smart `set` (add/remove/merge), `comparator` and
  `sort`, an id/cid index, model-event forwarding, and the Underscore-parity
  aggregators.
- `IntersectionObserver` visibility, `DOMParser` remote templates with a
  pluggable (CSP-safe) compiler, offline caching, a `Session` model, and
  composable input mixins.
- A real build producing `dist/app.js` and a minified bundle, JSDoc annotations,
  a `node:test` suite and GitHub Actions CI.

### Fixed

- The event system delivered a bare `Event` with no payload and the wrong `this`,
  and never emitted `change:<attr>`.
- `Utils.extend` used `.caller` (a `TypeError` in strict mode) and did not mutate
  its target, so custom sync headers were silently dropped.
- The template compiler threw on every compile.
- `Layout` threw on construction; `Session` never called `super()`.
- `delegateEvents` registered jQuery-style namespaced event types, so a View's
  declarative `events` hash never fired.
- `Utils.uniqueId` was time-based and collided within a millisecond, corrupting
  collection indexes and per-view event bindings.

### Removed

- jQuery, Underscore and Backbone from `lib/`.

[Unreleased]: https://github.com/makesites/app/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/makesites/app/compare/v0.6.1...v0.7.0
