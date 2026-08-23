# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
the project aims to follow [Semantic Versioning](https://semver.org/). While the
version is below 1.0.0, a **minor** bump may carry breaking changes; those are
always listed under *Breaking* below.

## [Unreleased]

Corrective and tooling work following an independent review of the 0.7.0 series.
No architectural changes — the roadmap §2 items (View split, going native on the
`_` shim, true ES modules, naming, plugin extraction) are all still ahead.

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

- **TypeScript declarations.** `types/app.d.ts` is generated from the JSDoc and
  shipped; `npm run types` regenerates it and type-checks a sample consumer that
  imports by package name, so the whole resolution chain is covered.
- **Source maps** for both bundles. `dist/app.min.js.map` chains through terser
  back to `lib/*.js`, so a minified stack trace resolves to the original source.
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

### Fixed

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
