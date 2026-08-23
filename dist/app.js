/**
 * @name @makesites/app
 * A zero-dependency, ES6 client-side application framework: models, collections, views, controllers, native router/history, templates, sessions and input mixins.
 *
 * Version: 0.8.0 (Sun, 23 Aug 2026 17:44:14 GMT)
 * Source: http://github.com/makesites/app
 *
 * @author makesites
 * Distributed by [Makesites.org](http://makesites.org)
 *
 * @license Released under the MPL v2.0, AGPL v3.0 licenses
 */

// lib/observable.js
var Observable = class {
  // A minimal pub/sub registry. Unlike the previous EventTarget approach this
  // passes the trigger arguments straight through to the callback and invokes
  // it with the right `this` (the listening object, or an explicit context).
  // alias of "on"
  bind(name, cb, context) {
    return this.on(name, cb, context);
  }
  /**
   * Subscribe to an event. Supports space-separated names ("add remove").
   * @param {string} name - event name(s)
   * @param {EventCallback} callback
   * @param {Object} [context] - `this` inside the callback (defaults to this object)
   * @returns {this}
   */
  on(name, callback, context) {
    if (!callback) return this;
    this._events || (this._events = {});
    var names = String(name).split(/\s+/);
    for (var k = 0; k < names.length; k++) {
      var handlers = this._events[names[k]] || (this._events[names[k]] = []);
      handlers.push({ callback, context, ctx: context || this });
    }
    return this;
  }
  /**
   * Subscribe to an event, firing the callback at most once.
   * @param {string} name - event name(s)
   * @param {EventCallback} callback
   * @param {Object} [context]
   * @returns {this}
   */
  once(name, callback, context) {
    var self2 = this;
    var ran = false;
    var wrap = function() {
      if (ran) return;
      ran = true;
      self2.off(name, wrap);
      return callback.apply(this, arguments);
    };
    wrap._callback = callback;
    return this.on(name, wrap, context);
  }
  /**
   * Remove callbacks. With no arguments removes all; otherwise filters by
   * event name, callback and/or context.
   * @param {string} [name]
   * @param {EventCallback} [callback]
   * @param {Object} [context]
   * @returns {this}
   */
  off(name, callback, context) {
    if (!this._events) return this;
    if (!name && !callback && !context) {
      this._events = {};
      return this;
    }
    var names = name ? String(name).split(/\s+/) : Object.keys(this._events);
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      var handlers = this._events[n];
      if (!handlers) continue;
      if (!callback && !context) {
        delete this._events[n];
        continue;
      }
      var remaining = [];
      for (var j = 0; j < handlers.length; j++) {
        var h = handlers[j];
        if (callback && callback !== h.callback && callback !== h.callback._callback || context && context !== h.context) {
          remaining.push(h);
        }
      }
      if (remaining.length) this._events[n] = remaining;
      else delete this._events[n];
    }
    return this;
  }
  /**
   * Emit an event, passing any extra arguments to the listeners.
   * @param {string} name - event name(s)
   * @param {...*} args - forwarded to each listener
   * @returns {this}
   */
  trigger(name, ...args) {
    if (!this._events) return this;
    var names = String(name).split(/\s+/);
    for (var k = 0; k < names.length; k++) {
      var handlers = this._events[names[k]];
      if (handlers) this._triggerHandlers(handlers, args);
      var all = this._events.all;
      if (all) this._triggerHandlers(all, [names[k]].concat(args));
    }
    return this;
  }
  // iterate over a copy so listeners may (un)subscribe during dispatch
  _triggerHandlers(handlers, args) {
    var list = handlers.slice();
    for (var i = 0; i < list.length; i++) {
      list[i].callback.apply(list[i].ctx, args);
    }
  }
  // Inversion-of-control listening. Tell *this* object to listen to another
  // object's events (bound to this context) and remember the binding so it can
  // be torn down in one call - crucial for avoiding leaks when views are removed.
  /**
   * Listen to another object's event, tracked so it can be torn down via
   * {@link Observable#stopListening} (e.g. when a view is removed).
   * @param {Observable} obj - the object to observe
   * @param {string} name - event name(s)
   * @param {EventCallback} callback - runs with THIS object as context
   * @returns {this}
   */
  listenTo(obj, name, callback) {
    if (!obj) return this;
    var listeningTo = this._listeningTo || (this._listeningTo = []);
    listeningTo.push({ obj, name, callback });
    obj.on(name, callback, this);
    return this;
  }
  /**
   * Listen to another object's event exactly once, then drop the binding.
   * Tracked like {@link Observable#listenTo}, so {@link Observable#stopListening}
   * also clears it if the event never fires.
   * @param {Observable} obj - the object to observe
   * @param {string} name - event name(s)
   * @param {EventCallback} callback - runs with THIS object as context
   * @returns {this}
   */
  listenToOnce(obj, name, callback) {
    if (!obj) return this;
    var self2 = this;
    var once = function() {
      self2.stopListening(obj, name, once);
      return callback.apply(this, arguments);
    };
    once._callback = callback;
    return this.listenTo(obj, name, once);
  }
  /**
   * Stop listening. With no arguments drops every listenTo binding; otherwise
   * filters by object, event name and/or callback.
   * @param {Observable} [obj]
   * @param {string} [name]
   * @param {EventCallback} [callback]
   * @returns {this}
   */
  stopListening(obj, name, callback) {
    var listeningTo = this._listeningTo;
    if (!listeningTo) return this;
    var remaining = [];
    for (var i = 0; i < listeningTo.length; i++) {
      var l = listeningTo[i];
      var match = (!obj || obj === l.obj) && (!name || name === l.name) && (!callback || callback === l.callback);
      if (match) {
        l.obj.off(l.name, l.callback, this);
      } else {
        remaining.push(l);
      }
    }
    this._listeningTo = remaining;
    return this;
  }
};

// lib/utils.js
var Utils = class {
  constructor() {
    this.templateSettings = {
      interpolate: /\{\{(.+?)\}\}/g,
      variable: "."
    };
    if (typeof Handlebars != "undefined") {
      this.mixin({
        template: Handlebars.compile
      });
    }
  }
  // Shallow-copy the own-enumerable properties of the source object(s) onto
  // the first argument, and return it. Matches the Underscore/Object.assign
  // contract callers rely on - both `_.extend({}, a, b)` and the mutating
  // `_.extend(target, patch)` forms work.
  //
  // (The previous implementation built a fresh object - so mutating callers
  // silently lost their changes - and used `_.extend.caller`, which throws in
  // strict mode / ES modules for any nested-object property.)
  /**
   * Shallow-merge the own-enumerable properties of each source onto the first
   * argument and return it. Both `_.extend({}, a, b)` and the mutating
   * `_.extend(target, patch)` forms work; falsy sources are skipped.
   * @param {Object} destination
   * @param {...Object} sources
   * @returns {Object} destination
   */
  extend(destination, ...sources) {
    destination = destination || {};
    for (var i = 0; i < sources.length; i++) {
      if (!sources[i]) continue;
      Object.assign(destination, sources[i]);
    }
    return destination;
  }
  /**
   * A random RFC-4122 v4 identifier.
   * @returns {string}
   */
  uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == "x" ? r : r & 3 | 8;
      return v.toString(16);
    });
  }
  // - Support Phonegap Shim: https://github.com/makesites/phonegap-shim
  isPhonegap() {
    return typeof PhoneGap != "undefined" && typeof PhoneGap.init != "undefined" && typeof PhoneGap.env != "undefined" && PhoneGap.env.app;
  }
  /*
  	isUndefined( obj ){
  		return (typeof obj == "undefined");
  	}
  */
  // Permanently bind the named methods to `context`.
  //
  // The hand-rolled wrapper this replaces called `f.apply(context)` with NO
  // arguments, so every bound method silently lost its parameters -
  // `_.bindAll(obj, "greet"); obj.greet("Ada", "!")` returned "hi undefinedundefined".
  // Function.prototype.bind forwards them, and is faster besides.
  /**
   * Permanently bind the named methods to `context`, so they can be passed as
   * detached callbacks.
   * @param {Object} context
   * @param {...string} methods
   * @returns {Object} context
   */
  bindAll(context, ...methods) {
    for (var i = 0; i < methods.length; i++) {
      var name = methods[i];
      if (typeof context[name] === "function") context[name] = context[name].bind(context);
    }
    return context;
  }
  // Source: https://locutus.io/php/var/empty/
  /**
   * PHP-style emptiness: `undefined`, `null`, `false`, `0`, `""`, `"0"` and an
   * object with no own keys are all empty.
   * @param {*} mixedVar
   * @returns {boolean}
   */
  isEmpty(mixedVar) {
    if (mixedVar === void 0 || mixedVar === null || mixedVar === false || mixedVar === 0 || mixedVar === "" || mixedVar === "0") return true;
    if (typeof mixedVar !== "object") return false;
    for (const key in mixedVar) {
      if (Object.prototype.hasOwnProperty.call(mixedVar, key)) return false;
    }
    return true;
  }
  isString(v) {
    return typeof v == "string";
  }
  /**
   * The element siblings of a node (excluding itself and text nodes).
   * @param {Element} elem
   * @returns {Element[]}
   */
  getSiblings(elem) {
    var siblings = [];
    var sibling = elem.parentNode.firstChild;
    while (sibling) {
      if (sibling.nodeType === 1 && sibling !== elem) {
        siblings.push(sibling);
      }
      sibling = sibling.nextSibling;
    }
    return siblings;
  }
  // A prefixed, monotonically-increasing unique id (used for cids).
  // (The previous time-based implementation collided for objects created in the
  // same millisecond, which broke cid uniqueness - and thus the collection
  // _byId index and per-view delegateEvents namespaces.)
  /**
   * A process-unique id, optionally prefixed — used for `cid`s.
   * @param {string} [prefix]
   * @returns {string}
   */
  uniqueId(prefix) {
    this._idCounter = (this._idCounter || 0) + 1;
    return (prefix ? prefix + "-" : "") + this._idCounter;
  }
  // ---
  // Underscore.js methods
  // Source: http://underscorejs.org/
  isNull(obj) {
    return obj === null;
  }
  isUndefined(obj) {
    return obj === void 0;
  }
  // Traverses the children of `obj` along `path`. If a child is a function, it
  // is invoked with its parent as context. Returns the value of the final
  // child, or `fallback` if any child is undefined.
  /**
   * Resolve a property that may be a value, a getter or a method: walks `path`
   * on `obj`, invoking any function it finds with its parent as context.
   * @param {Object} obj
   * @param {(string|string[])} path
   * @param {*} [fallback]
   * @returns {*}
   */
  result(obj, path, fallback) {
    path = Array.isArray(path) ? path : [path];
    var length = path.length;
    if (!length) {
      return typeof fallback === "function" ? fallback.call(obj) : fallback;
    }
    for (var i = 0; i < length; i++) {
      var prop = obj == null ? void 0 : obj[path[i]];
      if (prop === void 0) {
        prop = fallback;
        i = length;
      }
      obj = typeof prop === "function" ? prop.call(obj) : prop;
    }
    return obj;
  }
  // ---
  // Additional Underscore.js replacements (previously required the library)
  // Iterate over a list or an object's own values.
  //
  // Deliberately left as explicit loops. The "obvious" vanilla rewrite
  // (`Object.entries(obj).forEach(...)`) measured **4.3x SLOWER** here, because
  // it allocates an array of [key, value] pairs to walk an object we can walk
  // directly. Native is not automatically faster - it was measured.
  /**
   * Iterate an array's items or an object's own values.
   * @param {(Array|Object)} obj
   * @param {(value: *, key: (number|string), obj: *) => void} fn
   * @param {Object} [context]
   * @returns {(Array|Object)} obj
   */
  each(obj, fn, context) {
    if (obj == null) return obj;
    if (Array.isArray(obj)) {
      for (var i = 0; i < obj.length; i++) fn.call(context, obj[i], i, obj);
    } else {
      for (var key in obj) fn.call(context, obj[key], key, obj);
    }
    return obj;
  }
  // bind a function to a context (native)
  bind(fn, context) {
    return fn.bind(context);
  }
  // return a function that only runs after being called `times` times
  after(times, fn) {
    return function() {
      if (--times < 1) return fn.apply(this, arguments);
    };
  }
  // return a function that runs at most once, memoising the result
  once(fn) {
    var called = false, result;
    return function() {
      if (!called) {
        called = true;
        result = fn.apply(this, arguments);
      }
      return result;
    };
  }
  // the own-enumerable keys of an object
  keys(obj) {
    return obj == null ? [] : Object.keys(obj);
  }
  isFunction(obj) {
    return typeof obj === "function";
  }
  // Can `obj[name] = value` succeed? False when the name resolves to an
  // accessor with no setter anywhere on the prototype chain - assigning to one
  // throws in strict mode (all ES modules are strict), which is what broke
  // subclass getters before the resolve-merge lifecycle of commit 27. Use this
  // where a public name genuinely has to be assigned rather than resolved.
  /**
   * Can `obj[name] = value` succeed? False when the name resolves to an accessor
   * with no setter — assigning to one throws in strict mode.
   * @param {Object} obj
   * @param {string} name
   * @returns {boolean}
   */
  assignable(obj, name) {
    var target = obj;
    while (target) {
      var descriptor = Object.getOwnPropertyDescriptor(target, name);
      if (descriptor) return !!(descriptor.writable || descriptor.set);
      target = Object.getPrototypeOf(target);
    }
    return true;
  }
  // shallow value equality: strict for primitives, JSON for plain objects/arrays
  // (guarded, so circular structures compare unequal rather than throwing)
  /**
   * Value equality: strict for primitives, structural (via JSON) for plain
   * objects and arrays. Circular structures compare unequal rather than throwing.
   * @param {*} a
   * @param {*} b
   * @returns {boolean}
   */
  isEqual(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (e) {
      return false;
    }
  }
  // copy the properties of `obj` onto this utils instance (used to register a
  // template compiler, e.g. Handlebars)
  /**
   * Copy properties onto this utils instance — the extension point for
   * registering a template compiler, e.g. `_.mixin({ template: Handlebars.compile })`.
   * @param {Object} obj
   * @returns {this}
   */
  mixin(obj) {
    for (var key in obj) this[key] = obj[key];
    return this;
  }
};
var _ = new Utils();

// lib/base.js
var Base = class extends Observable {
  /**
   * @param {Object} [options]
   * @param {Object} [options.states] - state -> handler-name map, merged with the class's own
   */
  constructor(options) {
    super();
    options = options || {};
    this._optionStates = options.states || {};
    this.initStates();
  }
  // Events are inherited from Observable (on/off/once/trigger/listenTo/...)
  remove() {
    if (this._resizeTimer) {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = null;
    }
    return this;
  }
  // Remove DOM listeners this object registered on `this.el`.
  // - no arguments: every delegated listener (same as undelegateEvents)
  // - a type: the delegated listeners for that event type
  // - a type + callback: that specific listener
  //
  // This used to "remove all listeners" by replacing `this.el` with a clone of
  // itself. That was destructive: `this.el` kept pointing at the *original*,
  // which replaceWith had just detached from the document — so a View that was
  // handed an existing element (`new View({ el: "#main" })`) rendered into an
  // orphan node while an empty clone sat where the element used to be, and
  // `_inDOM()` then re-appended the orphan to the end of <body>, duplicating
  // the id. It also silently dropped listeners the framework never added.
  // Delegated listeners are tracked in `_delegateEvents`, so no clone is needed.
  unbind(name, cb) {
    if (!name) return this.undelegateEvents();
    var listeners = this._delegateEvents || [];
    var remaining = [];
    for (var i = 0; i < listeners.length; i++) {
      var listener = listeners[i];
      if (listener.type === name && (!cb || listener.handler === cb)) {
        if (this.el) this.el.removeEventListener(listener.type, listener.handler);
      } else {
        remaining.push(listener);
      }
    }
    this._delegateEvents = remaining;
    if (cb && this.el) this.el.removeEventListener(name, cb);
    return this;
  }
  delegateEvents(events) {
    events = events || _.extend({}, this._baseEvents, _.result(this, "events"));
    if (!events || !this.el) return this;
    this.undelegateEvents();
    var self2 = this;
    var splitter = /^(\S+)\s*(.*)$/;
    Object.keys(events).forEach(function(key) {
      var method = events[key];
      if (typeof method !== "function") method = self2[method];
      if (!method) return;
      var match = key.match(splitter);
      var type = match[1], selector = match[2];
      var handler = function(e) {
        if (!selector) {
          method.call(self2, e);
        } else {
          var target = e.target.closest(selector);
          if (target && self2.el.contains(target)) method.call(self2, e, target);
        }
      };
      self2.el.addEventListener(type, handler);
      self2._delegateEvents.push({ type, handler });
    });
    return this;
  }
  undelegateEvents() {
    var listeners = this._delegateEvents || [];
    if (this.el) {
      for (var i = 0; i < listeners.length; i++) {
        this.el.removeEventListener(listeners[i].type, listeners[i].handler);
      }
    }
    this._delegateEvents = [];
    return this;
  }
  // Element
  setElement(element) {
    this.undelegateEvents();
    this._setElement(element);
    this.delegateEvents();
    return this;
  }
  // TODO: internal method to do more than just save the element
  _setElement(el) {
    this.el = el;
  }
  /*
  	unbind( types, fn ) {
  		return this.off( types, null, fn );
  	}
  */
  // States
  // Source: https://github.com/makesites/backbone-states
  initStates() {
    var states = Object.assign({}, this._baseStates, this.states, this._optionStates);
    for (var e in states) {
      var method = states[e];
      if (typeof this[method] === "function") this.bind(e, this[method].bind(this));
    }
  }
};

// lib/cache.js
var store = {
  available: function() {
    try {
      return typeof localStorage !== "undefined" && localStorage !== null && typeof localStorage.getItem === "function" && typeof localStorage.setItem === "function";
    } catch (e) {
      return false;
    }
  },
  get: function(name) {
    try {
      return localStorage.getItem(name);
    } catch (e) {
      return null;
    }
  },
  set: function(name, val) {
    try {
      return localStorage.setItem(name, val);
    } catch (e) {
      return false;
    }
  },
  check: function(name) {
    return store.get(name) === null;
  },
  clear: function(name) {
    try {
      return localStorage.removeItem(name);
    } catch (e) {
      return false;
    }
  }
};

// lib/sync.js
var methodMap = {
  "create": "POST",
  "update": "PUT",
  "patch": "PATCH",
  "delete": "DELETE",
  "read": "GET"
};
var syncConfig = {
  base: "",
  // prepended to relative (non-absolute) request URLs
  credentials: null,
  // e.g. "include" to send cookies cross-origin
  headers: null
  // an object, or a function returning per-request headers
};
function configureSync(config) {
  return _.extend(syncConfig, config || {});
}
async function _syncRequest(method, model, options) {
  var type = methodMap[method];
  var params = {
    method: type,
    headers: {
      "Accept": "application/json, text/javascript, */*; q=0.01"
    }
  };
  if (syncConfig.credentials) params.credentials = syncConfig.credentials;
  if (syncConfig.headers) {
    var extra = typeof syncConfig.headers === "function" ? syncConfig.headers() : syncConfig.headers;
    if (extra) params.headers = _.extend(params.headers, extra);
  }
  if (options.fetchOptions) params = _.extend(params, options.fetchOptions);
  if (options.headers) params.headers = _.extend(params.headers || {}, options.headers);
  var url = options.url || _.result(model, "url");
  if (!url) throw new Error('A "url" property or function must be specified');
  if (syncConfig.base && !/^https?:\/\//.test(url)) url = syncConfig.base + url;
  if (options.data == null && model && (method === "create" || method === "update" || method === "patch")) {
    params.headers["Content-Type"] = "application/json";
    params.body = JSON.stringify(options.attrs || model.toJSON(options));
  } else if (options.data != null) {
    params.body = options.data;
  }
  var timer;
  if (typeof AbortController !== "undefined") {
    if (options.signal) {
      params.signal = options.signal;
    } else if (options.timeout) {
      var controller = new AbortController();
      params.signal = controller.signal;
      options.controller = controller;
      timer = setTimeout(function() {
        controller.abort();
      }, options.timeout);
    }
  }
  try {
    var response = await fetch(url, params);
    var responseData;
    var contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      responseData = await response.json();
    } else {
      var text = await response.text();
      responseData = text ? text : null;
    }
    if (!response.ok) {
      var error = new Error(response.statusText || "HTTP Error " + response.status);
      error.status = response.status;
      error.response = response;
      error.responseData = responseData;
      throw error;
    }
    if (model.options && model.options.cache && typeof model.cache === "function" && (method === "read" || method === "create" || method === "update" || method === "patch")) {
      model.cache(responseData);
    }
    if (options.success) options.success(responseData, response.statusText, response);
    return responseData;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function sync(method, model, options) {
  options = options || {};
  var retries = options.retry || 0;
  var base = options.retryDelay || 300;
  var attempt = 0;
  model.trigger("request", model, null, options);
  while (true) {
    try {
      return await _syncRequest(method, model, options);
    } catch (error) {
      var retriable = method === "read" && error.name !== "AbortError" && error.status == null;
      if (retriable && attempt < retries) {
        var delay = base * Math.pow(2, attempt) + Math.random() * base;
        attempt++;
        await new Promise(function(resolve) {
          setTimeout(resolve, delay);
        });
        if (!(options.signal && options.signal.aborted)) continue;
      }
      if (method === "read" && model.options && model.options.cache && typeof model.cache === "function") {
        var cached = model.cache();
        var hasData = Array.isArray(cached) ? cached.length > 0 : cached && Object.keys(cached).length > 0;
        if (hasData) {
          if (options.success) options.success(cached, "success-from-cache", null);
          return cached;
        }
      }
      if (options.error) options.error(error, error.statusText, error.response);
      model.trigger("error", model, error, options);
      throw error;
    }
  }
}

// lib/model.js
var Model = class extends Base {
  constructor(model, options = {}) {
    super(options);
    this.attributes = {};
    this.changed = {};
    this._previousAttributes = {};
    if (typeof this.idAttribute === "undefined") this.idAttribute = "id";
    options = options || {};
    this.options = _.extend({}, this._optionDefaults(), options);
    var attrs = _.extend({}, _.result(this, "defaults"), model && typeof model === "object" ? model : {});
    this.set(attrs);
    this.cid = _.uniqueId("model");
    this.initialize();
  }
  // framework option defaults (internal - not the model's attribute `defaults`)
  _optionDefaults() {
    return { autofetch: false, cache: false };
  }
  // initialization
  initialize() {
    if (this.options.cache) {
      var cache = this.cache();
      if (cache) this.set(cache);
    }
    if (this.options.autofetch && _.result(this, "url")) {
      this._autofetch();
    }
  }
  // autofetch is fire-and-forget: failures are reported through the "error"
  // event that sync() already fires, so the promise rejection is absorbed here
  // rather than surfacing as an unhandled rejection out of a constructor
  _autofetch() {
    var request = this.fetch();
    if (request && typeof request.catch === "function") request.catch(function() {
    });
    return request;
  }
  // Getter/Setter
  // add is like set but only if not available
  add(obj) {
    var self2 = this;
    var data = {};
    _.each(obj, function(item, key) {
      if (_.isUndefined(self2.get(key))) {
        data[key] = item;
      }
    });
    this.set(data);
  }
  // The model's payload.
  //
  // `data` is the library's convention for "the thing this object holds" -
  // Collection#data is its models, View#data is its source - so a Model exposes
  // its attributes under the same name. `attributes` remains as the
  // long-standing alias; both are the same object, so either can be read or
  // replaced.
  get data() {
    return this.attributes;
  }
  set data(value) {
    this.attributes = value || {};
  }
  /**
   * Get the value of an attribute.
   * @param {string} attr
   * @returns {*}
   */
  get(attr) {
    return this.attributes[attr];
  }
  has(attr) {
    return this.get(attr) != null;
  }
  /**
   * Set attribute(s), firing `change:<attr>` then `change` for what actually
   * changed. Accepts `(key, value)` or `({key: value})`.
   * @param {(string|Object)} key - attribute name, or a {attr: value} hash
   * @param {*} [val] - value (when key is a string)
   * @param {{silent?: boolean}} [options]
   * @returns {this}
   */
  set(key, val, options) {
    if (key == null) return this;
    var attrs;
    if (typeof key === "object") {
      attrs = key;
      options = val;
    } else {
      (attrs = {})[key] = val;
    }
    options = options || {};
    if (!this._validate(attrs, options)) return false;
    var unset = options.unset;
    var silent = options.silent;
    var changes = [];
    var changing = this._changing;
    this._changing = true;
    if (!changing) {
      this._previousAttributes = _.extend({}, this.attributes);
      this.changed = {};
    }
    var current = this.attributes;
    var prev = this._previousAttributes;
    if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];
    for (var attr in attrs) {
      val = attrs[attr];
      if (!_.isEqual(current[attr], val)) changes.push(attr);
      if (!_.isEqual(prev[attr], val)) this.changed[attr] = val;
      else delete this.changed[attr];
      if (unset) delete current[attr];
      else current[attr] = val;
    }
    if (!silent) {
      if (changes.length) this._pending = options;
      for (var i = 0; i < changes.length; i++) {
        this.trigger("change:" + changes[i], this, current[changes[i]], options);
      }
    }
    if (changing) return this;
    if (!silent) {
      while (this._pending) {
        options = this._pending;
        this._pending = false;
        this.trigger("change", this, options);
      }
    }
    this._pending = false;
    this._changing = false;
    return this;
  }
  // Validation
  // - override validate(attrs, options) to return an error to block set/save
  _validate(attrs, options) {
    if (!options.validate || !this.validate) return true;
    attrs = _.extend({}, this.attributes, attrs);
    var error = this.validationError = this.validate(attrs, options) || null;
    if (!error) return true;
    this.trigger("invalid", this, error, _.extend({}, options, { validationError: error }));
    return false;
  }
  // Change tracking
  hasChanged(attr) {
    if (attr == null) return !_.isEmpty(this.changed);
    return this.changed ? attr in this.changed : false;
  }
  changedAttributes(diff) {
    if (!diff) return this.hasChanged() ? _.extend({}, this.changed) : false;
    var old = this._previousAttributes;
    var changed = {}, has = false;
    for (var attr in diff) {
      if (_.isEqual(old[attr], diff[attr])) continue;
      changed[attr] = diff[attr];
      has = true;
    }
    return has ? changed : false;
  }
  previous(attr) {
    if (attr == null || !this._previousAttributes) return null;
    return this._previousAttributes[attr];
  }
  previousAttributes() {
    return _.extend({}, this._previousAttributes);
  }
  // #63 reset model to its (attribute) default values
  reset() {
    return this.clear().set(_.result(this, "defaults"));
  }
  // remove all attributes from the model (firing "change")
  clear(options) {
    options = options || {};
    this.attributes = {};
    if (!options.silent) this.trigger("change", this, options);
    return this;
  }
  // Cache
  // localStorage-backed cache (see cache.js). Call with data to store it, or
  // with no argument to retrieve it. Configure via options.cacheOptions:
  // { cache_key, cache_exclude:[], cache_timestamp }.
  cache(data) {
    if (!store.available()) return false;
    var opts = this.options && this.options.cacheOptions || {};
    var name = opts.cache_key || this.name || "model";
    if (data) {
      if (data[this.idAttribute]) name += "_" + data[this.idAttribute];
      var payload = _.extend({}, data);
      var exclude = opts.cache_exclude || [];
      for (var i = 0; i < exclude.length; i++) delete payload[exclude[i]];
      var value = JSON.stringify(payload);
      if (opts.cache_timestamp) {
        value = btoa(value);
        value = JSON.stringify({ data: value, timestamp: Date.now() });
      }
      return store.set(name, value);
    }
    if (this.get(this.idAttribute)) name += "_" + this.get(this.idAttribute);
    var cached = store.get(name);
    if (!cached) return false;
    cached = JSON.parse(cached);
    if (opts.cache_timestamp) cached = JSON.parse(atob(cached.data));
    return cached;
  }
  // Sync
  // - proxy to the native fetch()-based sync (see sync.js)
  sync(method, model, options) {
    return sync(method, model, options);
  }
  // Default URL: `urlRoot` (or the owning collection's url) + "/" + id.
  // Override with a `url` string/getter, or a `urlRoot` string/getter.
  url() {
    var base = _.result(this, "urlRoot") || this.collection && _.result(this.collection, "url") || null;
    if (!base) return null;
    if (this.isNew()) return base;
    return base.replace(/\/$/, "") + "/" + encodeURIComponent(this.get(this.idAttribute));
  }
  // a model is considered "new" until it has been assigned an id
  isNew() {
    return !this.has(this.idAttribute);
  }
  /**
   * Fetch the model from the server (GET) and apply the response.
   * @param {SyncOptions} [options]
   * @returns {Promise<*>}
   */
  fetch(options) {
    options = options || {};
    var self2 = this;
    var success = options.success;
    options.success = function(resp) {
      var data = self2.parse(resp, options);
      self2.set(data, options);
      if (success) success.call(options.context, self2, resp, options);
      self2.trigger("sync", self2, resp, options);
      self2.trigger("fetch", self2, resp, options);
    };
    return this.sync("read", this, options);
  }
  /**
   * Save the model to the server (POST when new, else PUT/PATCH).
   * @param {Object} [attrs] - attributes to set before saving
   * @param {SyncOptions} [options]
   * @returns {Promise<*>}
   */
  save(attrs, options) {
    options = options || {};
    if (options.validate === void 0) options.validate = true;
    if (attrs) {
      if (!this.set(attrs, options)) return false;
    } else if (!this._validate({}, options)) {
      return false;
    }
    var self2 = this;
    var success = options.success;
    options.attrs = options.attrs || this.toJSON();
    options.success = function(resp) {
      var data = self2.parse(resp, options);
      if (data) self2.set(data, options);
      if (success) success.call(options.context, self2, resp, options);
      self2.trigger("sync", self2, resp, options);
    };
    var method = this.isNew() ? "create" : options.patch ? "patch" : "update";
    return this.sync(method, this, options);
  }
  // delete the model from the server
  destroy(options) {
    options = options || {};
    var self2 = this;
    var success = options.success;
    var destroy = function() {
      self2.trigger("destroy", self2, self2.collection, options);
    };
    options.success = function(resp) {
      if (options.wait) destroy();
      if (success) success.call(options.context, self2, resp, options);
      if (!self2.isNew()) self2.trigger("sync", self2, resp, options);
    };
    if (this.isNew()) {
      if (!options.wait) destroy();
      options.success();
      return false;
    }
    if (!options.wait) destroy();
    return this.sync("delete", this, options);
  }
  // Events are inherited from Base (on/once/off/trigger/bind).
  // Helper functions
  // - check if the app is online
  // `app` is a global published by the APP facade; referencing it directly
  // threw a ReferenceError whenever no app had been instantiated (or outside a
  // browser), because `_.isUndefined(app)` still evaluates `app`. Only `typeof`
  // is safe on an undeclared identifier.
  isOnline() {
    return typeof app !== "undefined" && app && app.state ? app.state.online : true;
  }
  getValue(object, prop) {
    if (!(object && object[prop])) return null;
    return _.isFunction(object[prop]) ? object[prop]() : object[prop];
  }
  // Transform a server response before it is applied.
  //
  // This used to also `setTimeout(() => trigger("fetch"), 200)` - a side effect,
  // on a timer, inside a pure transform. It fired 200ms after the data had
  // already been applied (so listeners raced it), and it fired on save() too,
  // which is not a fetch. "fetch" is now emitted by fetch() itself, once the
  // response has been set.
  parse(data) {
    if (this.options.cache) {
      this.cache(data);
    }
    return data;
  }
  toJSON(options) {
    var obj = this.attributes;
    if (typeof obj !== "object") return obj;
    return Array.isArray(obj) ? obj.slice() : _.extend({}, obj);
  }
  // extract data (and possibly filter keys)
  output() {
    return this.toJSON();
  }
};

// lib/template.js
var RESERVED_WORDS = /* @__PURE__ */ new Set([
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "null",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "let",
  "static",
  "implements",
  "interface",
  "package",
  "private",
  "protected",
  "public",
  "await",
  "arguments",
  "eval"
]);
var Template = class _Template extends Model {
  /**
   * @param {string} [html] - inline markup to compile
   * @param {Object} [options] - { url, type, compiler }
   */
  constructor(html, options) {
    options = options || {};
    html = html || "";
    super({}, options);
    this.html = html;
    this.cid = _.uniqueId("template");
    this._setupTemplate();
  }
  // Compile the inline markup and/or start the remote load.
  //
  // This used to live in initialize(), which ran TWICE: Model's constructor
  // calls initialize() and Template's constructor called it again. On the first
  // pass `this.html` was still undefined (it is assigned after super()), but
  // `this.options.url` was already set - so a remote template was fetched twice
  // and "loaded" fired twice. Keeping the work here leaves initialize() as what
  // it is everywhere else in the framework: the subclass hook, called once.
  _setupTemplate() {
    var html = this.html;
    if (!_.isEmpty(html)) {
      this.set("default", this.compile(html));
      this.trigger("loaded");
    }
    if (this.options.url) {
      this.url = this.options.url;
      this.fetch();
    }
  }
  compile(markup) {
    var compiler = this.options && this.options.compiler;
    if (typeof compiler === "function") return compiler(markup);
    var cleanMarkup = _.isString(markup) ? markup : String(markup == null ? "" : markup);
    cleanMarkup = cleanMarkup.replace(/`/g, "\\`");
    var escape = this._sanitize();
    var compiled = /* @__PURE__ */ Object.create(null);
    var template = function(data) {
      data = data || {};
      const keys = ["data", "obj", "escape"];
      const values = [data, data, escape];
      Object.keys(data).forEach(function(key) {
        if (!_Template.isIdentifier(key) || keys.indexOf(key) > -1) return;
        keys.push(key);
        var value = data[key];
        values.push(typeof value === "string" ? escape(value) : value);
      });
      const signature = keys.join(",");
      const fn = compiled[signature] || (compiled[signature] = new Function(...keys, "return `" + cleanMarkup + "`"));
      return fn(...values);
    };
    return template;
  }
  // Is `name` usable as a function parameter? (a valid identifier, and not a
  // reserved word - `new Function("class", ...)` is a SyntaxError)
  static isIdentifier(name) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) && !RESERVED_WORDS.has(name);
  }
  // fetch a remote template file natively (no jQuery $.get)
  async fetch() {
    try {
      const response = await fetch(this.url);
      const html = await response.text();
      this.parse(html);
    } catch (err) {
      console.error("Failed to load template:", this.url, err);
    }
  }
  parse(data) {
    var self2 = this;
    var doc;
    try {
      doc = new DOMParser().parseFromString(data, "text/html");
    } catch (e) {
      doc = null;
    }
    var fragments = doc ? doc.querySelectorAll('template, script[type*="template"]') : [];
    if (!fragments.length) {
      this.set("default", self2.compile(data));
    } else {
      fragments.forEach(function(el) {
        if (el.id) self2.set(el.id, self2.compile(el.innerHTML));
      });
    }
    this.trigger("loaded");
  }
  // internal methods
  // returns a function that HTML-escapes a value; applied to interpolated data
  // (not to the markup itself) to prevent injection when set via innerHTML
  _sanitize() {
    const replaceTags = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return function(text) {
      return String(text).replace(/[&<>"']/g, (tag) => replaceTags[tag] || tag);
    };
  }
};

// lib/view.js
var resizeTargets = /* @__PURE__ */ new Set();
var resizeListener = null;
var resizeWindow = null;
function watchResize(view) {
  if (typeof window === "undefined") return;
  resizeTargets.add(view);
  if (resizeListener && resizeWindow === window) return;
  if (resizeListener && resizeWindow) resizeWindow.removeEventListener("resize", resizeListener);
  resizeListener = function(e) {
    resizeTargets.forEach(function(target) {
      if (target.resize === View.prototype.resize) return;
      target._resize(e);
    });
  };
  resizeWindow = window;
  resizeWindow.addEventListener("resize", resizeListener);
}
function unwatchResize(view) {
  resizeTargets.delete(view);
  if (resizeTargets.size || !resizeListener) return;
  if (resizeWindow) resizeWindow.removeEventListener("resize", resizeListener);
  resizeListener = null;
  resizeWindow = null;
}
var View = class extends Base {
  /**
   * @param {Object} [options] - { el, model, collection, data, html, url, template, ... }
   */
  constructor(options) {
    options = options || {};
    super(options);
    this.el = this._getEl(options);
    if (options.model && _.assignable(this, "model")) this.model = options.model;
    if (options.collection && _.assignable(this, "collection")) this.collection = options.collection;
    this.data = options.data || this.model || this.collection || null;
    this._baseStates = {
      "scroll": "_scroll"
    };
    this._baseEvents = {
      "click a[rel='external']": "clickExternal"
    };
    var defaults = _.extend({}, this._viewDefaults(), _.result(this, "defaults"));
    this.options = _.extend({}, defaults, options);
    this.options.hasData = !_.isNull(this.data);
    this.cid = _.uniqueId("view");
    this.initialize();
  }
  initialize() {
    var self2 = this;
    this.unbind();
    this.on("loaded", this._onLoaded.bind(this));
    this.on("loaded", this.onLoaded.bind(this));
    if (this.options.attr) {
      this.el.setAttribute("data-view", this.options.attr);
    } else {
      this.el.removeAttribute("data-view");
    }
    var html = this.options.html ? this.options.html : null;
    if (this.url && !this.options.url) this.options.url = this.url;
    var url = this._url(this.options);
    if (_.assignable(this, "url")) this.url = this._url;
    if (!this.options.type) this.options.type = "default";
    if (html || url || this.options.template) {
      let TMPL = this.options.template ? this.options.template : Template;
      this.template = typeof TMPL == "function" ? new TMPL(html, { url }) : TMPL;
      if (self2.options.autoRender && this.template.on) this.listenTo(this.template, "loaded", this.render);
    } else {
      this.template = null;
    }
    if (this.options.hasData && !_.isUndefined(this.data.on)) {
      this.listenTo(this.data, this.options.bind, this.render);
    }
    if (this._initRender()) {
      this.render();
    } else {
      this.trigger("loaded");
    }
    watchResize(this);
    this.initStates();
  }
  // The view's state Model, created on demand. Most of the lifecycle touches it
  // (render sets `loaded`), but a view that is constructed and never rendered -
  // or one that only ever has its own render() called - no longer pays for it.
  get state() {
    if (!this._state) {
      this._state = new Model();
      this._state.set({ loaded: false, scroll: false, visible: false });
    }
    return this._state;
  }
  set state(value) {
    this._state = value;
  }
  // built-in view option defaults (merged under any subclass get defaults()).
  // initStates() is now inherited from Base (resolve-merge of _baseStates).
  _viewDefaults() {
    return {
      data: false,
      html: false,
      template: false,
      url: false,
      bind: "add remove reset change",
      type: false,
      parentEl: false,
      autoRender: true,
      inRender: false,
      silentRender: false,
      renderTarget: false,
      resizeDelay: 1e3
    };
  }
  // parse URL in runtime (optionally)
  _url(options) {
    options = options || {};
    var url = options.url || this.options.url;
    return typeof url == "function" ? url() : url;
  }
  preRender() {
  }
  /**
   * Render the view's template into its element (or renderTarget). Override for
   * custom rendering.
   * @returns {void}
   */
  render() {
    this._preRender();
    var template = this._getTemplate();
    var data = this.toJSON();
    var html = template instanceof Function ? template(data) : template;
    if (html == null) return this._postRender();
    var container = this._findContainer();
    if (!this.el) {
      this.el = html;
    }
    this._inDOM();
    if (this.options.append) {
      container.append(this.el);
    } else if (this.options.prepend) {
      container.prepend(this.el);
    } else {
      container.innerHTML = html;
    }
    this._postRender();
  }
  postRender() {
  }
  // a more discrete way of binding events triggers to objects
  listen(obj, event, callback) {
    var e = typeof event == "string" ? [event] : event;
    for (var i in e) {
      this.listenTo(obj, e[i], callback);
    }
  }
  resize(e) {
  }
  clickExternal(e) {
    e.preventDefault();
    var url = this.findLink(e.target);
    if (typeof pageTracker != "undefined") url = pageTracker._getLinkerUrl(url);
    try {
      window.plugins.childBrowser.showWebPage(url);
    } catch (exp) {
      window.open(url, "_blank");
    }
    return false;
  }
  // attach to an event for a tab like effect
  clickTab(e) {
    e.preventDefault();
    let section = this.findLink(e.target);
    let sectionEl = this.el.querySelector(section);
    sectionEl.style.display = "block";
    var siblings = _.getSiblings(sectionEl);
    siblings.forEach((sibling) => sibling.style.display = "none");
    var li = e.target.closest("li");
    if (li) {
      li.classList.add("selected");
      _.getSiblings(li).forEach(function(sibling) {
        sibling.classList.remove("selected");
      });
    }
  }
  findLink(obj) {
    if (obj.tagName != "A") {
      var link = obj.closest("a");
      return link ? link.getAttribute("href") : null;
    } else {
      return obj.getAttribute("href");
    }
  }
  toJSON() {
    var data = this._toJSON();
    return this.options.inRender ? { data, options: this.options } : data;
  }
  onLoaded() {
  }
  // Helpers
  // call methods from the parent
  parent(method, options) {
    method = method || "";
    options = options || {};
    this.__inherit = this.__inherit || [];
    var parent = this.__inherit[method] || this._parent || {};
    var proto = parent.prototype || Object.getPrototypeOf(this).constructor.__super__;
    var fn = proto[method] || function() {
      delete this.__inherit[method];
    };
    var args = options instanceof Array ? options : [options];
    this.__inherit[method] = proto._parent || function() {
    };
    return fn.apply(this, args);
  }
  // Internal methods
  // Resolve the view's element: an `el` option (an element or a selector), or
  // a new one built from the Backbone-style declarations.
  //
  // `tagName` / `className` / `id` / `attributes` were accepted nowhere before:
  // a view without an `el` always got a bare `<div>`, so
  // `new View({ tagName: "li", className: "card" })` silently produced the wrong
  // element. They may be passed as options or declared on the subclass (they are
  // only ever read, so a getter or a function is fine - `attributes` as a
  // function is the Backbone idiom).
  _getEl(options) {
    var el = options.el;
    if (typeof el === "string") el = document.querySelector(el);
    if (el) return el;
    var tagName = options.tagName || _.result(this, "tagName") || "div";
    el = document.createElement(tagName);
    var attributes = _.extend({}, _.result(this, "attributes"), options.attributes);
    var className = options.className || _.result(this, "className");
    var id = options.id || _.result(this, "id");
    if (className) attributes["class"] = className;
    if (id) attributes.id = id;
    for (var key in attributes) {
      if (attributes[key] != null) el.setAttribute(key, attributes[key]);
    }
    return el;
  }
  // - render
  _initRender() {
    if (!this.options.autoRender) return false;
    var template = this._getTemplate();
    var hasMarkup = this.options.html || this.options.url && template;
    var hasData = this.options.hasData && (_.isUndefined(this.data.toJSON) || !_.isUndefined(this.data.toJSON) && !_.isEmpty(this.data.toJSON()));
    if (hasMarkup && hasData) return true;
    if (hasMarkup && !this.options.hasData) return true;
    if (hasData && !this.options.url) return true;
    return false;
  }
  _preRender() {
    this.preRender();
  }
  _postRender() {
    if (!this.options.silentRender) this.el.style.display = "block";
    if (!this.options.hasData || this.options.hasData && !_.isEmpty(this._toJSON())) {
      this.el.classList.remove("loading");
      this.state.set("loaded", true);
      this.trigger("loaded");
    }
    this.postRender();
  }
  // get the JSON of the data
  _toJSON() {
    if (!this.options.hasData) return {};
    if (this.data.toJSON) return this.data.toJSON();
    return this.data;
  }
  _getTemplate() {
    if (!this.template) return void 0;
    return this.options.type ? this.template.get(this.options.type) : this.template;
  }
  _onLoaded() {
    this.setElement(this.el);
  }
  // - container is defined in three ways
  // * renderTarget is the element
  // * renderTarget inside the element
  // * renderTarget outside the element (bad practice?)
  _findContainer() {
    var target = this.options.renderTarget;
    if (!target) return this.el;
    if (typeof target !== "string") return target;
    var container = this.el ? this.el.querySelector(target) : null;
    if (!container && typeof document !== "undefined") container = document.querySelector(target);
    return container || this.el;
  }
  // checks if an element exists in the DOM
  _inDOM(el) {
    el = el || this.el;
    if (!el) return false;
    var parent = document.querySelector(this.options.parentEl || "body");
    var exists = parent.contains(el);
    if (exists) return true;
    if (this.options.parentPrepend) {
      parent.prepend(el);
    } else {
      parent.append(el);
    }
  }
  // - When navigate is triggered
  _navigate(e) {
  }
  // resize event trigger (debounced)
  // The timer has to live on the instance: it used to be a local `var timeout`,
  // so `clearTimeout( timeout )` always cleared `undefined` and every single
  // resize event scheduled its own callback - no debouncing at all.
  _resize() {
    var self2 = this;
    var args = Array.prototype.slice.call(arguments);
    var delay = this.options && this.options.resizeDelay || 1e3;
    clearTimeout(this._resizeTimer);
    this._resizeTimer = setTimeout(function() {
      self2._resizeTimer = null;
      self2.resize.apply(self2, args);
    }, delay);
  }
  //
  _scroll() {
  }
  /**
   * Subscribe to an event. Overridden so that asking for "visible" / "hidden"
   * starts the IntersectionObserver - it is not created until something wants it.
   * @param {string} name
   * @param {EventCallback} callback
   * @param {Object} [context]
   * @returns {this}
   */
  on(name, callback, context) {
    var result = super.on(name, callback, context);
    if (/(^|\s)(visible|hidden)(\s|$)/.test(String(name))) this._setupVisibilityObserver();
    return result;
  }
  // checks if the view is visible
  // (state is maintained natively by the IntersectionObserver, started here on
  // first use if nothing has subscribed to visible/hidden yet)
  isVisible() {
    this._setupVisibilityObserver();
    return this.state.get("visible");
  }
  // - visibility monitoring via the native IntersectionObserver API.
  // Replaces the expensive jQuery scroll/offset math: the browser delegates
  // this to the compositor thread at effectively zero main-thread cost, and
  // emits "visible"/"hidden" as the element enters/leaves the viewport.
  _setupVisibilityObserver() {
    if (this.observer) return;
    if (typeof IntersectionObserver === "undefined" || !this.el) return;
    var self2 = this;
    this.observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        var visible = entry.isIntersecting;
        if (visible !== self2.state.get("visible")) {
          self2.state.set("visible", visible);
          self2.trigger(visible ? "visible" : "hidden");
        }
      });
    });
    this.observer.observe(this.el);
  }
  /**
   * Tear the view down: drop all listenTo bindings, stop the visibility
   * observer, and detach the element from the DOM.
   * @returns {this}
   */
  remove() {
    this.stopListening();
    this.undelegateEvents();
    unwatchResize(this);
    if (this.observer) this.observer.disconnect();
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
    super.remove();
  }
};

// lib/router.js
var optionalParam = /\((.*?)\)/g;
var namedParam = /(\(\?)?:\w+/g;
var splatParam = /\*\w+/g;
var escapeRegExp = /[-{}[\]+?.,\\^$|#\s]/g;
var routeStripper = /^[#/]|\s+$/g;
var rootStripper = /^\/+|\/+$/g;
var pathStripper = /#.*$/;
var Router = class extends Base {
  /**
   * @param {Object} [options]
   * @param {Object} [options.routes] - route -> handler-name map
   */
  constructor(options) {
    options = options || {};
    super(options);
    if (options.routes) this._optionRoutes = options.routes;
  }
  initialize() {
  }
  // Bind all defined routes to `history`.
  _bindRoutes() {
    var routes = _.extend({}, _.result(this, "routes"), this._optionRoutes);
    var route, names = Object.keys(routes);
    if (!names.length) return;
    while ((route = names.pop()) != null) {
      this.route(route, routes[route]);
    }
  }
  /**
   * Register a route. `route` may be a pattern string (":id", "*splat",
   * "(/optional)") or a RegExp.
   * @param {(string|RegExp)} route
   * @param {(string|Function)} name - handler name, or the handler itself
   * @param {Function} [callback]
   * @returns {this}
   */
  route(route, name, callback) {
    if (!(route instanceof RegExp)) route = this._routeToRegExp(route);
    if (typeof name === "function") {
      callback = name;
      name = "";
    }
    if (!callback) callback = this[name];
    var self2 = this;
    history.route(route, function(fragment) {
      var args = self2._extractParameters(route, fragment);
      if (self2.execute(callback, args, name) !== false) {
        self2.trigger("route:" + name, args);
        self2.trigger("route", name, args);
        history.trigger("route", self2, name, args);
      }
    });
    return this;
  }
  /**
   * Run a matched route handler. Override to add pre/post logic (e.g. auth
   * guards); return `false` to cancel the route.
   * @param {Function} callback
   * @param {Array} args - extracted route params
   * @param {string} [name]
   * @returns {(boolean|void)}
   */
  execute(callback, args, name) {
    if (callback) callback.apply(this, args);
  }
  /**
   * Navigate to a URL fragment via history.
   * @param {string} fragment
   * @param {{trigger?: boolean, replace?: boolean}} [options]
   * @returns {this}
   */
  navigate(fragment, options) {
    history.navigate(fragment, options);
    return this;
  }
  // Convert a route string into a regular expression, suitable for matching
  // against the current location's fragment.
  _routeToRegExp(route) {
    route = route.replace(escapeRegExp, "\\$&").replace(optionalParam, "(?:$1)?").replace(namedParam, function(match, optional) {
      return optional ? match : "([^/?]+)";
    }).replace(splatParam, "([^?]*?)");
    return new RegExp("^" + route + "(?:\\?([\\s\\S]*))?$");
  }
  // Given a route, and a URL fragment that it matches, return the array of
  // extracted decoded parameters.
  _extractParameters(route, fragment) {
    var params = route.exec(fragment).slice(1);
    return params.map(function(param, i) {
      if (i === params.length - 1) return param || null;
      return param ? decodeURIComponent(param) : null;
    });
  }
};
var History = class _History extends Base {
  constructor() {
    super({});
    this.handlers = [];
    this.checkUrl = this.checkUrl.bind(this);
    if (typeof window !== "undefined") {
      this.location = window.location;
      this.history = window.history;
    }
  }
  // Are we at the app root?
  atRoot() {
    var path = this.location.pathname.replace(/[^/]$/, "$&/");
    return path === this.root && !this.location.search;
  }
  // Get the cross-browser normalized URL fragment from the hash.
  getHash(win) {
    var match = (win || this).location.href.match(/#(.*)$/);
    return match ? match[1] : "";
  }
  // Get the pathname and search params, without the root.
  getFragment(fragment, forcePushState) {
    if (fragment == null) {
      if (this._hasPushState || !this._wantsHashChange || forcePushState) {
        fragment = decodeURI(this.location.pathname + this.location.search);
        var root = this.root.replace(/\/$/, "");
        if (!fragment.indexOf(root)) fragment = fragment.slice(root.length);
      } else {
        fragment = this.getHash();
      }
    }
    return fragment.replace(routeStripper, "");
  }
  // Start monitoring the hash/pushState changes.
  start(options) {
    if (_History.started) throw new Error("history has already been started");
    _History.started = true;
    this.options = _.extend({ root: "/" }, this.options, options);
    this.root = this.options.root;
    this._wantsHashChange = this.options.hashChange !== false;
    this._wantsPushState = !!this.options.pushState;
    this._hasPushState = !!(this.options.pushState && this.history && this.history.pushState);
    var fragment = this.getFragment();
    this.root = ("/" + this.root + "/").replace(rootStripper, "/");
    if (this._hasPushState) {
      window.addEventListener("popstate", this.checkUrl);
    } else if (this._wantsHashChange && "onhashchange" in window) {
      window.addEventListener("hashchange", this.checkUrl);
    }
    this.fragment = fragment;
    if (!this.options.silent) return this.loadUrl();
  }
  // Disable history, perhaps temporarily. Not useful in a real app, but
  // possibly useful for unit testing Routers.
  stop() {
    if (typeof window !== "undefined") {
      window.removeEventListener("popstate", this.checkUrl);
      window.removeEventListener("hashchange", this.checkUrl);
    }
    _History.started = false;
  }
  // Add a route to be tested when the fragment changes.
  route(route, callback) {
    this.handlers.unshift({ route, callback });
  }
  // Checks the current URL to see if it has changed, and if it has, loads it.
  checkUrl() {
    var current = this.getFragment();
    if (current === this.fragment) return false;
    this.loadUrl();
  }
  // Attempt to load the current URL fragment.
  loadUrl(fragment) {
    if (!_History.started) return false;
    fragment = this.fragment = this.getFragment(fragment);
    return this.handlers.some(function(handler) {
      if (handler.route.test(fragment)) {
        handler.callback(fragment);
        return true;
      }
    });
  }
  // Save a fragment into the hash history, or replace the URL state if the
  // 'replace' option is passed. You are responsible for properly URL-encoding
  // the fragment in advance.
  navigate(fragment, options) {
    if (!_History.started) return false;
    if (!options || options === true) options = { trigger: !!options };
    fragment = this.getFragment(fragment || "");
    var url = this.root + fragment;
    fragment = fragment.replace(pathStripper, "");
    if (this.fragment === fragment) return;
    this.fragment = fragment;
    if (fragment === "" && url !== "/") url = url.slice(0, -1);
    if (this._hasPushState) {
      this.history[options.replace ? "replaceState" : "pushState"]({}, document.title, url);
    } else if (this._wantsHashChange) {
      this._updateHash(this.location, fragment, options.replace);
    } else {
      return this.location.assign(url);
    }
    if (options.trigger) return this.loadUrl(fragment);
  }
  // Update the hash location, either replacing the current entry, or adding a
  // new one to the browser history.
  _updateHash(location, fragment, replace) {
    if (replace) {
      var href = location.href.replace(/(javascript:|#).*$/, "");
      location.replace(href + "#" + fragment);
    } else {
      location.hash = "#" + fragment;
    }
  }
};
History.started = false;
var history = new History();

// lib/session.js
var Session = class extends Model {
  /**
   * @param {Object} [model] - initial attributes
   * @param {Object} [options] - { host, url, local, remote, broadcast, persist }
   */
  constructor(model, options) {
    options = options || {};
    var defaults = {
      auth: 0,
      updated: 0,
      broadcast: true,
      local: true,
      remote: true,
      persist: false,
      host: ""
    };
    var opts = _.extend({}, defaults, options);
    super(model, opts);
  }
  initialize() {
    this.state = false;
    this.update = this.update.bind(this);
    this.cache = this.cache.bind(this);
    this.logout = this.logout.bind(this);
    this.error = this.error.bind(this);
    if (this.options.url) this.url = this.options.url;
    if (!this.options.persist && sessionStore.available()) {
      this.store = sessionStore;
    } else if (this.options.persist && localStore.available()) {
      this.store = localStore;
    } else if (cookieStore.available()) {
      this.store = cookieStore;
    } else {
      this.store = memoryStore;
    }
    var localSession = this.store.get("session");
    if (_.isNull(localSession) || !this.options.local) {
      this.fetch();
    } else {
      this.set(JSON.parse(localSession));
      this.set({ updated: 0 });
      if (!this.get("auth") && this.options.remote) this.fetch();
      if (this.options.broadcast) this.save();
    }
    this.bind("change", this.update);
    this.bind("error", this.error);
    this.on("logout", this.logout);
  }
  url() {
    return this.options.host + "/session";
  }
  parse(data) {
    if (_.isNull(data)) return;
    if (typeof data.updated == "undefined") {
      data.updated = Date.now();
    }
    if (!data.id) data.id = this.generateUid();
    return data;
  }
  sync(method, model, options) {
    options = options || {};
    if (!this.options.remote || !this.options.broadcast && method != "read") {
      this.update();
      return Promise.resolve();
    }
    return super.sync(method, model, options);
  }
  update() {
    if (!this.state) {
      this.state = true;
      this.trigger("loaded");
    }
    if (this.get("updated") || !this.options.remote) {
      this.cache();
    }
  }
  cache() {
    this.store.set("session", JSON.stringify(this.toJSON()));
  }
  // Destroy session - Source: http://backbonetutorials.com/cross-domain-sessions/
  logout(options) {
    var self2 = this;
    options = options || {};
    this.store.clear("session");
    this.destroy({
      wait: true,
      success: function(model, resp) {
        model.clear();
        model.id = null;
        self2.set({ auth: false });
        if (resp && resp._csrf) self2.set({ _csrf: resp._csrf });
        if (options.reload) {
          window.location.reload();
        }
      }
    });
  }
  // if data request fails request offline mode.
  error(model, req, options, error) {
    console.log(req);
  }
  // Helpers
  // - Creates a unique id for identification purposes
  generateUid(separator) {
    var delim = separator || "-";
    function S4() {
      return ((1 + Math.random()) * 65536 | 0).toString(16).substring(1);
    }
    return S4() + S4() + delim + S4() + delim + S4() + delim + S4() + delim + S4() + S4() + S4();
  }
};
var sessionStore = {
  available: function() {
    try {
      return typeof sessionStorage !== "undefined" && sessionStorage !== null && typeof sessionStorage.getItem === "function" && typeof sessionStorage.setItem === "function";
    } catch (e) {
      return false;
    }
  },
  get: function(name) {
    try {
      return sessionStorage.getItem(name);
    } catch (e) {
      return null;
    }
  },
  set: function(name, val) {
    try {
      return sessionStorage.setItem(name, val);
    } catch (e) {
      return false;
    }
  },
  check: function(name) {
    return sessionStore.get(name) == null;
  },
  clear: function(name) {
    try {
      return sessionStorage.removeItem(name);
    } catch (e) {
      return false;
    }
  }
};
var localStore = {
  available: function() {
    try {
      return typeof localStorage !== "undefined" && localStorage !== null && typeof localStorage.getItem === "function" && typeof localStorage.setItem === "function";
    } catch (e) {
      return false;
    }
  },
  get: function(name) {
    try {
      return localStorage.getItem(name);
    } catch (e) {
      return null;
    }
  },
  set: function(name, val) {
    try {
      return localStorage.setItem(name, val);
    } catch (e) {
      return false;
    }
  },
  check: function(name) {
    return localStore.get(name) == null;
  },
  clear: function(name) {
    try {
      return localStorage.removeItem(name);
    } catch (e) {
      return false;
    }
  }
};
var cookieStore = {
  available: function() {
    try {
      return typeof document !== "undefined" && typeof document.cookie === "string";
    } catch (e) {
      return false;
    }
  },
  get: function(name) {
    var i, key, value, cookies = document.cookie.split(";");
    for (i = 0; i < cookies.length; i++) {
      key = cookies[i].substr(0, cookies[i].indexOf("="));
      value = cookies[i].substr(cookies[i].indexOf("=") + 1);
      key = key.replace(/^\s+|\s+$/g, "");
      if (key == name) {
        return decodeURIComponent(value);
      }
    }
    return null;
  },
  set: function(name, val) {
    var expiry = 864e5;
    var date = new Date(Date.now() + parseInt(expiry));
    var value = encodeURIComponent(val) + "; expires=" + date.toUTCString();
    document.cookie = name + "=" + value;
  },
  check: function(name) {
    return cookieStore.get(name) == null;
  },
  clear: function(name) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
  }
};
var memoryStore = {
  _data: /* @__PURE__ */ Object.create(null),
  available: function() {
    return true;
  },
  get: function(name) {
    return name in memoryStore._data ? memoryStore._data[name] : null;
  },
  set: function(name, val) {
    memoryStore._data[name] = String(val);
    return true;
  },
  check: function(name) {
    return memoryStore.get(name) == null;
  },
  clear: function(name) {
    delete memoryStore._data[name];
    return true;
  }
};

// lib/state.js
function createState() {
  var hasNav = typeof navigator !== "undefined";
  var hasWin = typeof window !== "undefined";
  var hasDoc = typeof document !== "undefined";
  return {
    fullscreen: false,
    online: hasNav && "onLine" in navigator ? navigator.onLine : true,
    // find browser type
    browser: function() {
      if (!hasNav) return "other";
      if (/chrome/.test(navigator.userAgent.toLowerCase())) return "chrome";
      if (/firefox/.test(navigator.userAgent.toLowerCase())) return "firefox";
      if (/safari/.test(navigator.userAgent.toLowerCase())) return "safari";
      if (navigator.appName == "Microsoft Internet Explorer") return "ie";
      if (/android/.test(navigator.userAgent.toLowerCase())) return "android";
      if (/(iPhone|iPod).*OS 5.*AppleWebKit.*Mobile.*Safari/.test(navigator.userAgent)) return "ios";
      if (navigator.userAgent.indexOf("Opera Mini") !== -1) return "opera-mini";
      return "other";
    },
    mobile: hasNav ? navigator.userAgent.match(/Android/i) || navigator.userAgent.match(/webOS/i) || navigator.userAgent.match(/iPhone/i) || navigator.userAgent.match(/iPod/i) || navigator.userAgent.match(/BlackBerry/i) : false,
    ipad: hasNav ? navigator.userAgent.match(/iPad/i) !== null : false,
    retina: hasWin ? window.retina || window.devicePixelRatio > 1 : false,
    // check if there's a touch screen
    touch: hasDoc ? "ontouchstart" in document.documentElement : false,
    pushstate: function() {
      try {
        window.history.pushState({ "pageTitle": document.title }, document.title, window.location);
        return true;
      } catch (e) {
        return false;
      }
    },
    scroll: true,
    ram: function() {
      return typeof console !== "undefined" && console.memory ? Math.round(100 * (console.memory.usedJSHeapSize / console.memory.totalJSHeapSize)) : 0;
    },
    standalone: function() {
      return typeof navigator !== "undefined" && "standalone" in navigator && navigator.standalone || typeof PhoneGap != "undefined" && !_.isUndefined(PhoneGap.env) && PhoneGap.env.app || typeof external != "undefined" && typeof external.msIsSiteMode == "function" && external.msIsSiteMode();
    },
    framed: typeof self !== "undefined" && typeof top !== "undefined" ? top !== self : false
  };
}

// lib/controller.js
var Controller = class extends Router {
  /**
   * @param {Object} [options] - { api, autostart, pushState, location, p404, session, app }
   */
  constructor(options) {
    options = options || {};
    super(options);
    this.data = new Model();
    options = options || {};
    this.options = _.extend({}, this._optionDefaults(), _.result(this, "defaults"), options);
    this._baseRoutes = {
      "": "index",
      "_=_": "_fixFB",
      "access_token=:token": "access_token",
      "logout": "logout"
      //"*path"  : "_404"
    };
    this.app = options.app || null;
    this.state = this.app ? this.app.state : createState();
    this.cid = _.uniqueId("controller");
    this.initialize();
  }
  // framework option defaults, kept internal so a subclass can declare
  // `get defaults()` (mirrors Model#_optionDefaults / Collection#_optionDefaults)
  _optionDefaults() {
    return {
      api: false,
      autostart: true,
      location: false,
      pushState: false,
      p404: "/"
    };
  }
  initialize() {
    this._setup();
    this._bindRoutes();
    if (this.options.autostart && typeof window !== "undefined") history.start({ pushState: this.options.pushState });
  }
  update() {
    var scroll = this.state instanceof Model ? this.state.get("scroll") : this.state.scroll;
    if (scroll) {
      document.body.classList.remove("no-scroll");
    } else {
      document.body.classList.add("no-scroll");
    }
  }
  // Routes
  // default route - override with custom method
  index() {
  }
  // vanilla logout route
  logout() {
    if (this.session) this.session.trigger("logout", { reload: true });
    this.navigate("/", true);
  }
  // this method wil be executed before "every" route!
  preRoute(options, callback) {
    var self2 = this;
    if (this.session && typeof this.session.state !== "undefined") {
      if (!this.session.state) {
        return this.session.bind("loaded", _.once(function() {
          callback.apply(self2, options);
        }));
      } else {
        return callback.apply(self2, options);
      }
    }
    return callback.apply(self2, options);
  }
  access_token(token) {
    if (this.session) {
      this.session.set({ "token": token });
    } else {
      window.access_token = token;
    }
    this.navigate("/", true);
  }
  // - internal
  // collection of setup methods
  _setup() {
    if (this.options.api) this._ajaxPrefilter(this.options.api);
    if (this.options.location) {
      this._geoLocation();
    }
    this._setupConnectivity();
    if (this.options.pushState) this._setupLinks();
    this._setupSession();
  }
  // keep state.online in sync with the browser connectivity, emitting
  // "online"/"offline" so the app can react (replaces UA/navigator polling)
  _setupConnectivity() {
    if (typeof window === "undefined") return;
    var self2 = this;
    window.addEventListener("online", function() {
      self2.state.online = true;
      self2.trigger("online");
    });
    window.addEventListener("offline", function() {
      self2.state.online = false;
      self2.trigger("offline");
    });
  }
  // intercept clicks on internal links and route them through history,
  // avoiding full-page reloads (native port of the legacy layout _clickLink)
  _setupLinks() {
    if (typeof document === "undefined") return;
    var self2 = this;
    document.body.addEventListener("click", function(e) {
      var link = e.target.closest("a");
      if (!link) return;
      var href = link.getAttribute("href");
      var external2 = link.getAttribute("rel") === "external" || link.getAttribute("target");
      if (!href || external2 || href.charAt(0) === "#" || /^https?:\/\//.test(href)) return;
      if (href.charAt(0) !== "/") return;
      e.preventDefault();
      self2.navigate(href, { trigger: true });
    });
  }
  // - setup session: reuse the app-owned session, or create one when
  //   configured standalone (opt-in via options.session)
  _setupSession() {
    if (this.app && this.app.session) {
      this.session = this.app.session;
      return;
    }
    if (!this.options.session) return;
    var SessionClass = APP.Session || Session;
    if (SessionClass) this.session = new SessionClass({}, this.options.session);
  }
  // set the api base url (+ credentials + CSRF) for all sync requests
  // native replacement for the old jQuery $.ajaxPrefilter
  _ajaxPrefilter(api) {
    var self2 = this;
    configureSync({
      // prepend the API base to relative URLs
      base: api,
      // send cookies (servers that set Access-Control-Allow-Credentials: true)
      credentials: "include",
      // attach the CSRF token from the session, when available
      headers: function() {
        var session = self2.session || false;
        var csrf = session ? session._csrf || session.get("_csrf") || false : false;
        return csrf ? { "X-CSRF-Token": csrf } : {};
      }
    });
  }
  // addressing the issue: http://stackoverflow.com/q/7131909
  _fixFB() {
    this.navigate("/", true);
  }
  _layoutUpdate(path) {
    if (this.layout) this.layout.trigger("update", { navigate: true, path });
  }
  // - overriding default _bindRoutes
  _bindRoutes() {
    var routes = _.extend({}, this._baseRoutes, _.result(this, "routes"), this._optionRoutes);
    var route, names = Object.keys(routes);
    while (typeof (route = names.pop()) !== "undefined") {
      var name = routes[route];
      this.route(route, name, this._callRoute(this[name]));
    }
  }
  // special execution of a route (with pre-logic)
  _callRoute(route) {
    return function() {
      this.preRoute.call(this, arguments, route);
    };
  }
  _geoLocation() {
    var self2 = this;
    navigator.geolocation.getCurrentPosition(
      function(data) {
        self2.state.location = data;
      },
      function() {
        console.log("error", arguments);
      }
    );
    setTimeout(function() {
      self2._geoLocation();
    }, 3e4);
  }
  // Fallback 404 route
  _404(path) {
    var msg = "Unable to find path: " + path;
    console.log(msg);
    this.navigate(this.options.p404);
  }
};

// lib/collection.js
var Collection = class extends Base {
  /**
   * @param {Array} [models] - models (or plain attribute objects) to populate with
   * @param {Object} [options]
   */
  constructor(models, options = {}) {
    super(options);
    var ModelClass = options.model || this.model || Model;
    if (_.assignable(this, "model")) this.model = ModelClass;
    this._reset();
    options = options || {};
    this.options = _.extend({}, this._optionDefaults(), _.result(this, "defaults"), options);
    if (options.comparator !== void 0) this._comparator = options.comparator;
    this.cid = _.uniqueId("collection");
    this.initialize(models, options);
    if (models) this.reset(models, { silent: true });
  }
  // framework option defaults, kept internal (mirrors Model#_optionDefaults and
  // View#_viewDefaults) so a subclass is free to declare `get defaults()` — the
  // constructor used to assign `this.defaults`, which threw over a getter
  _optionDefaults() {
    return { _synced: false, autofetch: false, cache: false };
  }
  // (re)initialise the internal store: the data array + the id/cid index.
  // The index is a null-prototype object so that ids colliding with
  // Object.prototype members ("constructor", "toString", ...) can't resolve to
  // an inherited value instead of a model.
  _reset() {
    this.data = [];
    this._byId = /* @__PURE__ */ Object.create(null);
  }
  // initialization hook (override freely)
  initialize(models, options) {
    if (this.options.cache) {
      var cache = this.cache();
      if (cache) this.add(cache);
    }
    if (this.options.autofetch && _.isEmpty(models) && _.result(this, "url")) {
      this._autofetch();
    }
  }
  // see Model#_autofetch - fire-and-forget, failures surface as "error" events
  _autofetch() {
    var request = this.fetch();
    if (request && typeof request.catch === "function") request.catch(function() {
    });
    return request;
  }
  /*
  	render(){
  
  	}
  */
  update() {
  }
  /**
   * Add one or many models/objects (deduped by id via set()). Fires "add".
   * @param {(Object|Model|Array)} models
   * @param {Object} [options]
   * @returns {(Model|Array)}
   */
  add(models, options) {
    return this.set(models, _.extend({ merge: false }, options, { add: true, remove: false }));
  }
  /**
   * The "smart" update: add new models, merge existing ones (matched by id) and
   * remove any not present in `models`. Options { add, remove, merge, sort,
   * silent } (all default true except silent). Fires add / remove / sort / update.
   * @param {(Object|Model|Array)} models
   * @param {Object} [options] - { add, remove, merge, sort, silent }
   * @returns {(Model|Array)}
   */
  set(models, options) {
    if (models == null) return this;
    options = _.extend({ add: true, remove: true, merge: true }, options);
    var singular = !Array.isArray(models);
    var list = singular ? [models] : models.slice();
    var toAdd = [], keep = {};
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var id = this._idOf(item);
      var existing = item && item.cid && this._byId[item.cid] || (id != null ? this._byId[id] : null);
      if (existing) {
        if (options.merge && item !== existing) {
          existing.set(item.attributes ? item.attributes : item, options);
        }
        keep[existing.cid] = true;
      } else if (options.add) {
        var model = this._prepareModel(item, options);
        this._index(model);
        toAdd.push(model);
        keep[model.cid] = true;
      }
    }
    var removed = [];
    if (options.remove) {
      for (var j = this.data.length - 1; j >= 0; j--) {
        var m = this.data[j];
        if (!keep[m.cid]) {
          this.data.splice(j, 1);
          this._removeReference(m);
          removed.push(m);
        }
      }
    }
    for (var k = 0; k < toAdd.length; k++) {
      this.data.push(toAdd[k]);
      this._addReference(toAdd[k]);
    }
    var sorted = false;
    if ((this.comparator || this._comparator) && toAdd.length && options.sort !== false) {
      this.sort({ silent: true });
      sorted = true;
    }
    if (!options.silent) {
      for (var a = 0; a < toAdd.length; a++) this.trigger("add", toAdd[a], this, options);
      for (var r = 0; r < removed.length; r++) this.trigger("remove", removed[r], this, options);
      if (sorted) this.trigger("sort", this, options);
      if (toAdd.length || removed.length) this.trigger("update", this, options);
    }
    var firstId = this._idOf(list[0]);
    return singular ? toAdd[0] || (firstId != null ? this._byId[firstId] : null) : this.data;
  }
  // resolve the id of a model instance or a plain attributes object
  _idOf(item) {
    if (item == null) return void 0;
    if (item.cid && item.get) return item.get(item.idAttribute);
    var idAttr = this.model && this.model.prototype && this.model.prototype.idAttribute || "id";
    return item[idAttr];
  }
  // wrap plain attributes in this.model (or return an existing model)
  _prepareModel(attrs, options) {
    if (attrs && attrs.cid && attrs.get) return attrs;
    return new this.model(attrs, options);
  }
  /**
   * Sort by the comparator (function(model)->key, function(a,b)->number, or an
   * attribute-name string). Fires "sort".
   * @returns {this}
   */
  /** @param {Object} [options] */
  sort(options) {
    var comparator = this.comparator || this._comparator;
    if (!comparator) return this;
    options = options || {};
    var self2 = this;
    if (typeof comparator === "string") {
      this.data.sort(function(a, b) {
        var av = a.get(comparator), bv = b.get(comparator);
        return av < bv ? -1 : av > bv ? 1 : 0;
      });
    } else if (comparator.length === 1) {
      this.data.sort(function(a, b) {
        var av = comparator.call(self2, a), bv = comparator.call(self2, b);
        return av < bv ? -1 : av > bv ? 1 : 0;
      });
    } else {
      this.data.sort(comparator.bind(this));
    }
    if (!options.silent) this.trigger("sort", this, options);
    return this;
  }
  /**
   * Remove a model - accepts a model, an id, or a cid. Fires "remove".
   * @param {(Model|string|number|Array)} target
   * @param {Object} [options]
   * @returns {?Model}
   */
  remove(target, options) {
    options = options || {};
    if (Array.isArray(target)) {
      var self2 = this;
      return target.map(function(t) {
        return self2.remove(t, options);
      });
    }
    var model = target && target.cid ? target : this.get(target);
    if (!model) return null;
    var index = this.data.indexOf(model);
    if (index > -1) this.data.splice(index, 1);
    this._removeReference(model);
    if (!options.silent) this.trigger("remove", model, this, options);
    return model;
  }
  /**
   * Replace all models at once, firing a single "reset".
   * @param {Array} [models]
   * @param {Object} [options]
   * @returns {this}
   */
  reset(models, options) {
    options = options || {};
    for (var i = 0; i < this.data.length; i++) this._removeReference(this.data[i]);
    options.previousModels = this.data;
    this._reset();
    if (models) this.add(models, _.extend({}, options, { silent: true }));
    this.options._synced = true;
    if (!options.silent) this.trigger("reset", this, options);
    return this;
  }
  // index a model by cid and by id (both point at the same model)
  _index(model) {
    if (!model) return;
    if (model.cid) this._byId[model.cid] = model;
    var id = model.get ? model.get(model.idAttribute || "id") : null;
    if (id != null) this._byId[id] = model;
  }
  // maintain the id/cid index + a back-reference, and forward the model's events
  _addReference(model) {
    if (!model) return;
    this._index(model);
    if (!model.collection) model.collection = this;
    if (model.on) model.on("all", this._onModelEvent, this);
  }
  _removeReference(model) {
    if (!model) return;
    if (model.cid) delete this._byId[model.cid];
    var id = model.get ? model.get(model.idAttribute || "id") : null;
    if (id != null) delete this._byId[id];
    if (model.collection === this) delete model.collection;
    if (model.off) model.off("all", this._onModelEvent, this);
  }
  // forward a member model's events onto the collection; drop destroyed members
  // and keep the id index fresh when a member's id changes
  _onModelEvent() {
    var args = Array.prototype.slice.call(arguments);
    var event = args[0], model = args[1];
    if (event === "destroy") this.remove(model);
    if (model && event === "change:" + model.idAttribute) {
      var prev = model.previous(model.idAttribute);
      if (prev != null) delete this._byId[prev];
      if (model.id != null) this._byId[model.id] = model;
    }
    this.trigger.apply(this, args);
  }
  /**
   * Save every model in the collection. Resolves when all have saved.
   * @param {SyncOptions} [options]
   * @returns {Promise<Array>}
   */
  save(options) {
    options = options || {};
    var promises = this.data.map(function(model) {
      return model.save(null, options);
    });
    return Promise.all(promises);
  }
  // Sync
  // - proxy to the native fetch()-based sync (see sync.js)
  sync(method, model, options) {
    return sync(method, model, options);
  }
  // fetch the collection from the server
  fetch(options) {
    options = options || {};
    var self2 = this;
    var success = options.success;
    options.success = function(resp) {
      var data = self2.parse(resp, options);
      self2[options.reset ? "reset" : "set"](data, options);
      self2.options._synced = true;
      if (success) success.call(options.context, self2, resp, options);
      self2.trigger("sync", self2, resp, options);
      self2.trigger("fetch", self2, resp, options);
    };
    return this.sync("read", this, options);
  }
  /**
   * Retrieve a single model by array index, id, name, or cid.
   * @param {(number|string)} key
   * @returns {?Model}
   */
  get(key) {
    if (key == null) return null;
    if (key.cid) return this._byId[key.cid] || null;
    if (this._byId[key] != null) return this._byId[key];
    if (Number.isInteger(key)) return this.data[key] || null;
    for (var i = 0; i < this.data.length; i++) {
      if (key === this.data[i].get("name")) return this.data[i];
    }
    return null;
  }
  // the model at a specific index
  at(index) {
    return this.data[index];
  }
  // Array methods
  // --------------
  // Proxy the modern native Array.prototype methods to the internal `data`
  // array. Replaces the old Underscore.js iteration mixins - the V8 engine
  // is heavily optimised for these native methods. Legacy Underscore aliases
  // (each/collect/all/any/contains) are kept so existing app code won't break.
  forEach(callback, thisArg) {
    return this.data.forEach(callback, thisArg);
  }
  each(callback, thisArg) {
    return this.forEach(callback, thisArg);
  }
  map(callback, thisArg) {
    return this.data.map(callback, thisArg);
  }
  collect(callback, thisArg) {
    return this.map(callback, thisArg);
  }
  reduce(callback, initial) {
    return arguments.length > 1 ? this.data.reduce(callback, initial) : this.data.reduce(callback);
  }
  reduceRight(callback, initial) {
    return arguments.length > 1 ? this.data.reduceRight(callback, initial) : this.data.reduceRight(callback);
  }
  find(callback, thisArg) {
    return this.data.find(callback, thisArg);
  }
  findIndex(callback, thisArg) {
    return this.data.findIndex(callback, thisArg);
  }
  filter(callback, thisArg) {
    return this.data.filter(callback, thisArg);
  }
  reject(callback, thisArg) {
    return this.data.filter(function(model, i, arr) {
      return !callback.call(thisArg, model, i, arr);
    });
  }
  every(callback, thisArg) {
    return this.data.every(callback, thisArg);
  }
  all(callback, thisArg) {
    return this.every(callback, thisArg);
  }
  some(callback, thisArg) {
    return this.data.some(callback, thisArg);
  }
  any(callback, thisArg) {
    return this.some(callback, thisArg);
  }
  includes(model, fromIndex) {
    return this.data.includes(model, fromIndex);
  }
  contains(model, fromIndex) {
    return this.includes(model, fromIndex);
  }
  indexOf(model, fromIndex) {
    return this.data.indexOf(model, fromIndex);
  }
  lastIndexOf(model, fromIndex) {
    return this.data.lastIndexOf(model, fromIndex);
  }
  slice(start, end) {
    return this.data.slice(start, end);
  }
  toArray() {
    return this.slice();
  }
  // Collection specific helpers (native)
  // pluck an attribute from every model in the collection
  pluck(attr) {
    return this.map(function(model) {
      return model.get(attr);
    });
  }
  // return the models with matching attributes
  where(attrs, first) {
    if (!attrs || Object.keys(attrs).length === 0) return first ? void 0 : [];
    var matcher = function(model) {
      for (var key in attrs) {
        if (attrs[key] !== model.get(key)) return false;
      }
      return true;
    };
    return first ? this.find(matcher) : this.filter(matcher);
  }
  // return the first model with matching attributes
  findWhere(attrs) {
    return this.where(attrs, true);
  }
  isEmpty() {
    return this.length === 0;
  }
  // Underscore-style aggregation helpers (native over this.data)
  // ------------------------------------------------------------
  // The grouping/aggregating helpers Backbone inherited from Underscore, kept
  // as thin native implementations. An "iteratee" is either an attribute-name
  // string (resolved via model.get) or a function called with the model.
  // normalise an iteratee to a function(model) -> value
  _iteratee(iter) {
    if (iter == null) return function(model) {
      return model;
    };
    if (typeof iter === "string") return function(model) {
      return model.get(iter);
    };
    return iter;
  }
  // shared bucketing engine: apply `behavior(result, key, model)` per model
  _group(iter, behavior) {
    var fn = this._iteratee(iter), result = {};
    this.forEach(function(model) {
      behavior(result, fn.call(this, model), model);
    }, this);
    return result;
  }
  // group the models into arrays keyed by the iteratee result
  groupBy(iter) {
    return this._group(iter, function(result, key, model) {
      (result[key] || (result[key] = [])).push(model);
    });
  }
  // count the models keyed by the iteratee result
  countBy(iter) {
    return this._group(iter, function(result, key) {
      result[key] = (result[key] || 0) + 1;
    });
  }
  // a stably-sorted *copy* of the models, ascending by the iteratee result.
  // Non-destructive — unlike sort(), which reorders this.data in place.
  sortBy(iter) {
    var fn = this._iteratee(iter), self2 = this;
    return this.slice().map(function(model, index) {
      return { model, key: fn.call(self2, model), index };
    }).sort(function(a, b) {
      if (a.key !== b.key) return a.key < b.key ? -1 : 1;
      return a.index - b.index;
    }).map(function(entry) {
      return entry.model;
    });
  }
  // call a named method on every model, returning the array of results
  invoke(method) {
    var args = Array.prototype.slice.call(arguments, 1);
    return this.map(function(model) {
      var fn = model == null ? null : model[method];
      return fn ? fn.apply(model, args) : void 0;
    });
  }
  // split the models into [ pass, fail ] by a predicate(model)
  partition(predicate) {
    var pass = [], fail = [];
    this.forEach(function(model) {
      (predicate(model) ? pass : fail).push(model);
    });
    return [pass, fail];
  }
  // the model with the smallest iteratee result (undefined when empty)
  min(iter) {
    var fn = this._iteratee(iter), result, best = Infinity;
    this.forEach(function(model) {
      var value = fn.call(this, model);
      if (value < best) {
        best = value;
        result = model;
      }
    }, this);
    return result;
  }
  // the model with the largest iteratee result (undefined when empty)
  max(iter) {
    var fn = this._iteratee(iter), result, best = -Infinity;
    this.forEach(function(model) {
      var value = fn.call(this, model);
      if (value > best) {
        best = value;
        result = model;
      }
    }, this);
    return result;
  }
  // a random model, or an array of `n` distinct random models (Fisher–Yates)
  sample(n) {
    if (n == null) return this.data[Math.floor(Math.random() * this.length)];
    var copy = this.slice(), count = Math.max(0, Math.min(n, copy.length));
    for (var i = 0; i < count; i++) {
      var rand = i + Math.floor(Math.random() * (copy.length - i));
      var tmp = copy[i];
      copy[i] = copy[rand];
      copy[rand] = tmp;
    }
    return copy.slice(0, count);
  }
  // getters (native paradigm favours these over size()/length())
  get length() {
    return this.data.length;
  }
  // alias mirroring the classic Backbone `models` array
  get models() {
    return this.data;
  }
  get size() {
    return this.length;
  }
  // Cache
  // stores/retrieves the collection as a list of model ids in localStorage,
  // resolving each id back to its individually-cached model on read.
  cache(data) {
    if (!store.available()) return false;
    var opts = this.options && this.options.cacheOptions || {};
    var name = opts.cache_key || this.name || this.cid;
    if (data) {
      var ids = data.map(function(item) {
        return item.id || item._id;
      });
      return store.set(name, JSON.stringify(ids));
    }
    var stored = store.get(name);
    if (!stored) return false;
    var list = JSON.parse(stored);
    var ModelClass = this.model;
    var sample = new ModelClass();
    var mopts = sample.options && sample.options.cacheOptions || {};
    var mname = mopts.cache_key || sample.name || "model";
    return list.map(function(id) {
      var mdata = store.get(mname + "_" + id);
      return mdata ? JSON.parse(mdata) : {};
    });
  }
  // Transform a server response before it is applied.
  //
  // This used to also `setTimeout(() => trigger("fetch"), 200)` - a side effect,
  // on a timer, inside a pure transform. It fired 200ms after the data had
  // already been applied (so listeners raced it), and it fired on save() too,
  // which is not a fetch. "fetch" is now emitted by fetch() itself, once the
  // response has been set.
  parse(data) {
    if (this.options.cache) {
      this.cache(data);
    }
    return data;
  }
  // serialise the collection to a plain array of the models' data
  toJSON(options) {
    return this.data.map(function(model) {
      return model && typeof model.toJSON === "function" ? model.toJSON(options) : model;
    });
  }
  // extract data (and possibly filter keys)
  output() {
    return this.toJSON();
  }
  isNew() {
    return this.options._synced === false;
  }
  // - check if the app is online
  // see Model#isOnline: only `typeof` is safe on the (possibly undeclared)
  // `app` global that the APP facade publishes
  isOnline() {
    return typeof app !== "undefined" && app && app.state ? app.state.online : true;
  }
};

// lib/layout.js
var Layout = class extends View {
  /**
   * @param {Object} [options] - { el (defaults to body), url, autosync, sync_events }
   */
  constructor(options) {
    options = options || {};
    options.el = options.el || "body";
    options = _.extend({
      autosync: false,
      autorender: true,
      sync_events: "add remove change"
    }, options);
    super(options);
    this.cid = _.uniqueId("layout");
    var self2 = this;
    this._onClick = function(e) {
      self2._clickLink(e);
    };
    this.el.addEventListener("click", this._onClick);
  }
  initialize() {
    this.views = {};
    this.on("update", this.update, this);
    if (this.options.url || this.url) {
      var url = this.options.url || this.url;
      if (!this.options.type) this.options.type = "default";
      this.template = new Template(null, { url });
      if (this.options.autorender) this.template.on("loaded", this.render, this);
    }
  }
  preRender() {
  }
  render() {
    this._preRender();
    this.el.classList.remove("loading");
    if (this.template) {
      var template = this.options.type ? this.template.get(this.options.type) : this.template;
      var html = template instanceof Function ? template(this.options) : template;
      this.el.innerHTML = html;
    }
    this._postRender();
  }
  postRender() {
  }
  update(e) {
    e = e || false;
    if (!e) return;
    if (e.navigate) {
      for (var i in this.views) {
        if (typeof this.views[i]._navigate === "function") this.views[i]._navigate(e);
      }
    }
  }
  // setter and getter mirroring the Model methods
  set(views) {
    for (var i in views) {
      this.listenTo(views[i], "loaded", this._viewLoaded);
      views[i]._name = i;
      if (views[i].data) {
        views[i].data._view = i;
        this.listenTo(views[i].data, this.options.sync_events, this._syncData);
      }
      this.views[i] = views[i];
    }
    return this.views;
  }
  get(view) {
    return this.views[view];
  }
  /**
   * With a name, removes that child view (what this method has always done).
   * With no arguments, tears the layout itself down — the `View#remove()`
   * contract.
   *
   * The two used to be the same method with incompatible signatures, so
   * `layout.remove()` silently did nothing: it looked up `this.views[undefined]`,
   * found nothing and returned. A Layout could therefore never be torn down,
   * including through `app.views.remove( name )`, which calls `view.remove()`.
   * `removeView( name )` is the clearer name for the child-view case; `remove( name )`
   * still works.
   * @param {string} [name]
   * @returns {this}
   */
  remove(name) {
    if (name !== void 0) return this.removeView(name);
    this.stopListening();
    this.undelegateEvents();
    if (this.el && this._onClick) {
      this.el.removeEventListener("click", this._onClick);
      this._onClick = null;
    }
    for (var name_ in this.views) this.removeView(name_);
    return this;
  }
  /**
   * Remove a registered child view: drops the layout's bindings to it and its
   * data, tears the view down, and forgets it.
   * @param {string} name
   * @returns {this}
   */
  removeView(name) {
    var view = this.get(name);
    if (_.isUndefined(view)) return this;
    this.stopListening(view);
    if (view.data) this.stopListening(view.data);
    view.remove();
    delete this.views[name];
    return this;
  }
  findLink(target) {
    var link = target.tagName != "A" ? target.closest("a") : target;
    if (!link) return false;
    var url = link.getAttribute("href");
    var isLocal = url ? url.substr(0, 1) == "#" || url.substr(0, 2) == "/#" && window.location.pathname == "/" : false;
    return _.isEmpty(url) || isLocal || link.getAttribute("target") ? false : url;
  }
  // Internal methods
  _preRender() {
    if (typeof app !== "undefined" && app.state && app.state.touch) this.el.classList.add("touch");
    this.preRender();
  }
  _postRender() {
    this.postRender();
  }
  _viewLoaded() {
    var registered = 0, loaded = 0;
    _.each(this.views, function(view) {
      if (view.state && view.state.get && view.state.get("loaded")) loaded++;
      registered++;
    });
    if (registered && registered == loaded) {
      this._allViewsLoaded();
    }
  }
  // what to do after all views are loaded (once)
  _allViewsLoaded() {
    if (this._loaded) return;
    this._loaded = true;
    this.render();
  }
  // broadcast all data updates in the views back to the layout
  _syncData(model, collection, options) {
    var value;
    var data = collection || model || false;
    if (!data) return;
    var key = data._view || false;
    if (!key) return;
    if (this.model instanceof Model) {
      var keys = Object.keys(this.model.attributes) || [];
      if (keys.indexOf(key) == -1) return;
      try {
        value = data.output();
      } catch (e) {
        value = data.toJSON();
      }
      if (value) {
        var attr = {};
        attr[key] = value;
        this.model.set(attr);
        if (this.options.autosync) {
          this.model.save();
        }
      }
    }
  }
  _clickLink(e) {
    var link = e.target.closest("a");
    if (link) {
      var rel = link.getAttribute("rel");
      if (rel === "external" || rel === "alternate") return;
    }
    var url = this.findLink(e.target);
    if (url) {
      this.el.classList.add("loading");
    }
    if (url && typeof app !== "undefined" && app.state && typeof app.state.standalone === "function" && app.state.standalone()) {
      e.preventDefault();
      window.location = url;
      return false;
    }
  }
};

// lib/events.js
var Events = class extends Base {
  /**
   * @param {string} [name="app"] - channel/topic namespace (also the BroadcastChannel name)
   * @param {{broadcast?: boolean}} [options] - set broadcast:false to disable cross-tab
   */
  constructor(name, options) {
    options = options || {};
    super(options);
    this.name = name || "app";
    this.broadcast = options.broadcast !== false && typeof BroadcastChannel !== "undefined";
    if (this.broadcast) {
      this._channel = new BroadcastChannel(this.name);
      var self2 = this;
      this._channel.addEventListener("message", function(e) {
        var msg = e.data || {};
        self2._emit(msg.event, msg.args || []);
      });
    }
  }
  /**
   * Publish an event: deliver to local listeners now, then mirror to other tabs
   * via BroadcastChannel (structured-cloned; non-cloneable payloads stay local).
   * @param {string} name
   * @param {...*} args
   * @returns {this}
   */
  trigger(name, ...args) {
    this._emit(name, args);
    if (this._channel) {
      try {
        this._channel.postMessage({ event: name, args });
      } catch (e) {
      }
    }
    return this;
  }
  // deliver to local listeners via the Base registry (without re-broadcasting)
  _emit(name, args) {
    return Observable.prototype.trigger.apply(this, [name].concat(args));
  }
  // tear down the cross-tab channel and drop all listeners
  close() {
    if (this._channel) this._channel.close();
    this._channel = null;
    this.off();
  }
};

// lib/app.js
var Views = class {
  constructor() {
    this._views = {};
  }
  add(name, view) {
    this._views[name] = view;
    return view;
  }
  get(name) {
    return this._views[name];
  }
  remove(name) {
    var view = this._views[name];
    if (view && typeof view.remove === "function") view.remove();
    delete this._views[name];
    return this;
  }
  each(fn) {
    for (var key in this._views) fn(this._views[key], key);
    return this;
  }
  get all() {
    return this._views;
  }
};
var APP = class _APP {
  /**
   * @param {Object} [options]
   * @param {boolean} [options.pushState] - use the History pushState API
   * @param {string[]} [options.controllers] - controller names available to lazy-import
   * @param {Object} [options.session] - session config (enables app.session)
   */
  constructor(options) {
    options = options && typeof options === "object" ? options : {};
    this.name = "APP";
    options.routePath = options.routePath || "app/controllers/";
    options.pushState = options.pushState || false;
    this.options = options;
    this._routes = [];
    this.Routers = _APP.Controllers;
    this.state = createState();
    this.events = new Events("app");
    this.views = new Views();
    this.session = options.session ? new _APP.Session({}, options.session) : null;
    this.router = null;
    if (typeof window !== "undefined") window.app = this;
    this.ready = this.start();
  }
  // Resolve the controller and wire it to the app. Returns the facade.
  async start() {
    this.router = await this._resolveController();
    if (this.router) {
      this.router.app = this;
    }
    return this;
  }
  // Find and instantiate the controller: registered synchronously in
  // APP.Controllers, or lazily imported (route-based code splitting), falling
  // back to the default Controller.
  async _resolveController() {
    var options = this.options;
    var path = typeof window !== "undefined" ? window.location.pathname.split("/") : [];
    if (path[0] === "") path.shift();
    var route = !_.isEmpty(path[0]) ? path[0] : "default";
    var ucRoute = route.charAt(0).toUpperCase() + route.slice(1);
    options.app = this;
    if (typeof _APP.Controllers[ucRoute] === "function") return new _APP.Controllers[ucRoute](options);
    var list = options.controllers || [];
    if (list.includes(route) || list.includes("default")) {
      var name = list.includes(route) ? route : "default";
      var uc = name.charAt(0).toUpperCase() + name.slice(1);
      try {
        var specifier = "../" + options.routePath + name + ".js";
        var module = await import(
          /* @vite-ignore */
          specifier
        );
        var Ctrl = module[uc] || module.Default || module.Router || _APP.Controller;
        return new Ctrl(options);
      } catch (error) {
        console.error(error);
        return new (_APP.Controllers.Default || _APP.Controller)(options);
      }
    }
    return new (_APP.Controllers.Default || _APP.Controller)(options);
  }
  routes() {
    return this._routes;
  }
};
APP.ready = function(callback) {
  if (_.isPhonegap()) {
    return PhoneGap.init(callback);
  } else if (typeof document !== "undefined" && document.readyState !== "loading") {
    return setTimeout(callback, 0);
  } else if (typeof document !== "undefined") {
    return document.addEventListener("DOMContentLoaded", callback);
  }
};
APP.Observable = Observable;
APP.Utils = Utils;
APP.Model = Model;
APP.View = View;
APP.Controller = Controller;
APP.Router = Router;
APP.Template = Template;
APP.Collection = Collection;
APP.Layout = Layout;
APP.Session = Session;
APP.Events = Events;
APP.history = history;
APP._ = _;
APP.Models = {};
APP.Controllers = {};
APP.Collections = {};
APP.Views = {};
APP.Layouts = {};
APP.Templates = {};

// lib/input.js
var TouchMixin = (BaseClass) => class extends BaseClass {
  constructor(options = {}) {
    super(options);
    this.touchState = { touching: false, swiping: false, direction: false };
    this.touchParams = { start: null, previous: null, current: null };
    this.touchOptions = Object.assign({
      threshold: 10,
      inertia: 0,
      blocking: true,
      monitor: true
    }, options.touch || {});
    if (this.isTouch && this.touchOptions.monitor) {
      this._bindTouchEvents();
    }
  }
  get isTouch() {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }
  _bindTouchEvents() {
    const opts = this.touchOptions.blocking ? { passive: false } : { passive: true };
    this.el.addEventListener("touchstart", this._touchstart.bind(this), opts);
    this.el.addEventListener("touchmove", this._touchmove.bind(this), opts);
    this.el.addEventListener("touchend", this._touchend.bind(this), opts);
  }
  _touchstart(e) {
    const touch = e.touches[0];
    const coords = { x: touch.clientX, y: touch.clientY };
    this.touchState.touching = true;
    this.touchParams.start = coords;
    this.touchParams.previous = coords;
    this.touchParams.current = coords;
    this.trigger("touchstart", e);
  }
  _touchmove(e) {
    if (!this.touchState.touching) return;
    const touch = e.touches[0];
    const current = { x: touch.clientX, y: touch.clientY };
    const previous = this.touchParams.previous;
    const direction = this._calculateDirection(current, previous);
    this.touchState.swiping = !!direction;
    this.touchState.direction = direction;
    if (direction && this.touchOptions.blocking && e.cancelable) e.preventDefault();
    this.touchParams.previous = this.touchParams.current;
    this.touchParams.current = current;
    this.trigger("touchmove", e);
  }
  _touchend(e) {
    if (e.touches.length === 0) {
      this.touchState.touching = false;
      this.touchState.swiping = false;
      this.touchParams.start = null;
    }
    this.trigger("touchend", e);
  }
  _calculateDirection(current, previous) {
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const { inertia, threshold } = this.touchOptions;
    if (dx > inertia && Math.abs(dy) < threshold) return "right";
    if (dx < -inertia && Math.abs(dy) < threshold) return "left";
    if (dy > inertia && Math.abs(dx) < threshold) return "bottom";
    if (dy < -inertia && Math.abs(dx) < threshold) return "top";
    return false;
  }
  getSwipeDistance(axis = "x") {
    if (!this.touchParams.start || !this.touchParams.current) return 0;
    return this.touchParams.current[axis] - this.touchParams.start[axis];
  }
};
var MouseMixin = (BaseClass) => class extends BaseClass {
  constructor(options = {}) {
    super(options);
    this.mouseState = { hover: false, drag: false, pressing: false };
    this.mousePos = { x: 0, y: 0 };
    if (options.monitorMouse) this.monitorMouse();
  }
  monitorMouse() {
    this.el.addEventListener("mousemove", this._onMouseMove.bind(this), { passive: true });
    this.el.addEventListener("mousedown", () => {
      this.mouseState.pressing = true;
    }, { passive: true });
    this.el.addEventListener("mouseup", () => {
      this.mouseState.pressing = false;
    }, { passive: true });
  }
  _onMouseMove(e) {
    if (this._mouseTicking) return;
    this._mouseTicking = true;
    requestAnimationFrame(() => {
      this.mousePos.x = e.clientX;
      this.mousePos.y = e.clientY;
      this.trigger("mousemove", this.mousePos);
      this._mouseTicking = false;
    });
  }
};
var ScrollMixin = (BaseClass) => class extends BaseClass {
  constructor(options = {}) {
    super(options);
    this.scrollState = { top: 0, height: 0, max: 0 };
    if (options.monitorScroll) this.monitorScroll();
  }
  monitorScroll() {
    window.addEventListener("scroll", this._onScroll.bind(this), { passive: true });
  }
  _onScroll() {
    if (this._scrollTicking) return;
    this._scrollTicking = true;
    requestAnimationFrame(() => {
      this.scrollState.top = window.scrollY;
      this.scrollState.height = document.documentElement.scrollHeight;
      this.scrollState.max = this.scrollState.height - window.innerHeight;
      this.trigger("scroll", this.scrollState);
      this._scrollTicking = false;
    });
  }
};
var MotionMixin = (BaseClass) => class extends BaseClass {
  constructor(options = {}) {
    super(options);
    this.motionState = { alpha: 0, beta: 0, gamma: 0 };
    if (options.monitorMotion) this.monitorMotion();
  }
  monitorMotion() {
    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", this._onOrientation.bind(this), { passive: true });
    }
  }
  _onOrientation(e) {
    this.motionState = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
    this.trigger("deviceorientation", this.motionState);
  }
};
var BUTTON_MAP = ["button_a", "button_b", "button_x", "button_y", "bumper_left", "bumper_right", "trigger_left", "trigger_right", "button_select", "button_start", "stick_left_click", "stick_right_click", "dpad_up", "dpad_down", "dpad_left", "dpad_right", "button_home"];
var AXIS_MAP = ["stick_left_x", "stick_left_y", "stick_right_x", "stick_right_y"];
function applyDeadzone(value, deadzone, maximizeThreshold) {
  if (value >= 0) {
    if (value < deadzone) return 0;
    if (value > maximizeThreshold) return 1;
  } else {
    if (value > -deadzone) return 0;
    if (value < -maximizeThreshold) return -1;
  }
  return value;
}
var GamepadMixin = (BaseClass) => class extends BaseClass {
  constructor(options = {}) {
    super(options);
    this.gamepads = {};
    this._buttonStates = {};
    this._axisStates = {};
    this._pollingLoop = null;
    this.gamepadOptions = Object.assign({ deadzone: 0.05, maximizeThreshold: 0.97 }, options.gamepad || {});
    if (options.monitorGamepad) this.monitorGamepad();
  }
  monitorGamepad() {
    window.addEventListener("gamepadconnected", (e) => {
      this.gamepads[e.gamepad.index] = e.gamepad;
      this.trigger("gamepad-connect", e.gamepad);
      if (!this._pollingLoop) this._pollGamepads();
    });
    window.addEventListener("gamepaddisconnected", (e) => {
      delete this.gamepads[e.gamepad.index];
      this.trigger("gamepad-disconnect", e.gamepad);
      if (Object.keys(this.gamepads).length === 0) {
        cancelAnimationFrame(this._pollingLoop);
        this._pollingLoop = null;
      }
    });
  }
  _pollGamepads() {
    const hardwarePads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let pad of hardwarePads) {
      if (pad) {
        this._processGamepadButtons(pad);
        this._processGamepadAxes(pad);
        this.trigger("gamepad-update", pad);
      }
    }
    this._pollingLoop = requestAnimationFrame(this._pollGamepads.bind(this));
  }
  _processGamepadButtons(pad) {
    if (!this._buttonStates[pad.index]) this._buttonStates[pad.index] = [];
    const prevStates = this._buttonStates[pad.index];
    pad.buttons.forEach((button, index) => {
      const buttonName = BUTTON_MAP[index] || `button_${index}`;
      const wasPressed = prevStates[index];
      const isPressed = button.pressed;
      if (isPressed && !wasPressed) {
        this.trigger("gamepad-buttondown", { padIndex: pad.index, button: buttonName, value: button.value });
      } else if (!isPressed && wasPressed) {
        this.trigger("gamepad-buttonup", { padIndex: pad.index, button: buttonName });
      }
      prevStates[index] = isPressed;
    });
  }
  _processGamepadAxes(pad) {
    if (!this._axisStates[pad.index]) this._axisStates[pad.index] = [];
    const prevStates = this._axisStates[pad.index];
    const { deadzone, maximizeThreshold } = this.gamepadOptions;
    pad.axes.forEach((rawAxisValue, index) => {
      const axisName = AXIS_MAP[index] || `axis_${index}`;
      const filteredValue = applyDeadzone(rawAxisValue, deadzone, maximizeThreshold);
      const prevValue = prevStates[index] || 0;
      if (filteredValue !== prevValue) {
        this.trigger("gamepad-axis", { padIndex: pad.index, axis: axisName, value: filteredValue });
      }
      prevStates[index] = filteredValue;
    });
  }
};
var KeysMixin = (BaseClass) => class extends BaseClass {
  constructor(options = {}) {
    super(options);
    this.keyState = {};
    if (options.monitorKeys) this.monitorKeys();
  }
  monitorKeys() {
    const target = this.options.globalKeys ? window : this.el;
    target.addEventListener("keydown", this._onKeyDown.bind(this));
    target.addEventListener("keyup", this._onKeyUp.bind(this));
  }
  _onKeyDown(e) {
    this.keyState[e.code] = true;
    this.trigger("keydown", e);
    this._executeKeyAction(e);
  }
  _onKeyUp(e) {
    this.keyState[e.code] = false;
    this.trigger("keyup", e);
  }
  _executeKeyAction(e) {
    if (!this.keys) return;
    const methodName = this.keys[e.code] || this.keys[e.key];
    if (methodName && typeof this[methodName] === "function") {
      this[methodName](e);
    }
  }
  isKeyHeld(code) {
    return !!this.keyState[code];
  }
};

// lib/main.js
if (typeof window !== "undefined") window.APP = APP;
export {
  APP,
  Collection,
  Controller,
  Events,
  GamepadMixin,
  KeysMixin,
  Layout,
  Model,
  MotionMixin,
  MouseMixin,
  Observable,
  Router,
  ScrollMixin,
  Session,
  Template,
  TouchMixin,
  Utils,
  View,
  _,
  history,
  sync
};
//# sourceMappingURL=app.js.map
