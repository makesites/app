/**
 * @name @makesites/app
 * A zero-dependency, ES6 client-side application framework: models, collections, views, controllers, native router/history, templates, sessions and input mixins.
 *
 * Version: 0.8.0 (Sun, 23 Aug 2026 14:35:52 GMT)
 * Source: http://github.com/makesites/app
 *
 * @author makesites
 * Distributed by [Makesites.org](http://makesites.org)
 *
 * @license Released under the MPL v2.0, AGPL v3.0 licenses
 */

//import { APP } from "./app.js";



class Base {

	constructor( options ){
		// fallback(s)
		options = options || {};
		// states passed via options are merged with the class's own states at
		// init time (we never assign `this.states`, so subclass getters work)
		this._optionStates = options.states || {};

		this.initStates();

	}

	// Events
	// A minimal pub/sub registry. Unlike the previous EventTarget approach this
	// passes the trigger arguments straight through to the callback and invokes
	// it with the right `this` (the listening object, or an explicit context).

	// alias of "on"
	bind( name, cb, context ){
		return this.on( name, cb, context );
	}

	/**
	 * Subscribe to an event. Supports space-separated names ("add remove").
	 * @param {string} name - event name(s)
	 * @param {Function} callback
	 * @param {Object} [context] - `this` inside the callback (defaults to this object)
	 * @returns {this}
	 */
	on( name, callback, context ){
		if( !callback ) return this;
		this._events || (this._events = {});
		// support space-separated event names ("add remove reset change")
		var names = String(name).split(/\s+/);
		for( var k = 0; k < names.length; k++ ){
			var handlers = this._events[names[k]] || (this._events[names[k]] = []);
			handlers.push({ callback: callback, context: context, ctx: context || this });
		}
		return this;
	}

	// subscribe to an event, but only fire the callback once
	once( name, callback, context ){
		var self = this;
		var ran = false;
		var wrap = function(){
			if( ran ) return;
			ran = true;
			self.off( name, wrap );
			return callback.apply( this, arguments );
		};
		wrap._callback = callback;
		return this.on( name, wrap, context );
	}

	// remove callbacks. With no args removes all; by name / callback / context.
	off( name, callback, context ){
		if( !this._events ) return this;
		if( !name && !callback && !context ){ this._events = {}; return this; }
		var names = name ? String(name).split(/\s+/) : Object.keys( this._events );
		for( var i = 0; i < names.length; i++ ){
			var n = names[i];
			var handlers = this._events[n];
			if( !handlers ) continue;
			if( !callback && !context ){ delete this._events[n]; continue; }
			var remaining = [];
			for( var j = 0; j < handlers.length; j++ ){
				var h = handlers[j];
				if( (callback && callback !== h.callback && callback !== h.callback._callback) || (context && context !== h.context) ){
					remaining.push( h );
				}
			}
			if( remaining.length ) this._events[n] = remaining; else delete this._events[n];
		}
		return this;
	}

	/**
	 * Emit an event, passing any extra arguments to the listeners.
	 * @param {string} name - event name(s)
	 * @param {...*} args - forwarded to each listener
	 * @returns {this}
	 */
	trigger( name ){
		if( !this._events ) return this;
		var args = Array.prototype.slice.call( arguments, 1 );
		// support triggering several space-separated events at once
		var names = String(name).split(/\s+/);
		for( var k = 0; k < names.length; k++ ){
			var handlers = this._events[names[k]];
			if( handlers ) this._triggerHandlers( handlers, args );
			// "all" catch-all events receive the name as the first argument
			var all = this._events.all;
			if( all ) this._triggerHandlers( all, [names[k]].concat( args ) );
		}
		return this;
	}

	// iterate over a copy so listeners may (un)subscribe during dispatch
	_triggerHandlers( handlers, args ){
		var list = handlers.slice();
		for( var i = 0; i < list.length; i++ ){
			list[i].callback.apply( list[i].ctx, args );
		}
	}

	// Inversion-of-control listening. Tell *this* object to listen to another
	// object's events (bound to this context) and remember the binding so it can
	// be torn down in one call - crucial for avoiding leaks when views are removed.
	/**
	 * Listen to another object's event, tracked so it can be torn down via
	 * {@link Base#stopListening} (e.g. when a view is removed).
	 * @param {Base} obj - the object to observe
	 * @param {string} name - event name(s)
	 * @param {Function} callback - runs with THIS object as context
	 * @returns {this}
	 */
	listenTo( obj, name, callback ){
		if( !obj ) return this;
		var listeningTo = this._listeningTo || (this._listeningTo = []);
		listeningTo.push({ obj: obj, name: name, callback: callback });
		obj.on( name, callback, this );
		return this;
	}

	// Stop listening. With no args, drops every listenTo binding; otherwise
	// filters by object / event name / callback.
	stopListening( obj, name, callback ){
		var listeningTo = this._listeningTo;
		if( !listeningTo ) return this;
		var remaining = [];
		for( var i = 0; i < listeningTo.length; i++ ){
			var l = listeningTo[i];
			var match = ( !obj || obj === l.obj ) && ( !name || name === l.name ) && ( !callback || callback === l.callback );
			if( match ){
				l.obj.off( l.name, l.callback, this );
			} else {
				remaining.push( l );
			}
		}
		this._listeningTo = remaining;
		return this;
	}

	remove() {
		// stop resize monitoring. This has to be the *bound* handler that was
		// registered (`_onResize`): removeEventListener matches by identity, so
		// passing the prototype method `this._resize` removed nothing.
		if( typeof window !== "undefined" && this._onResize ){
			window.removeEventListener( "resize", this._onResize );
		}
		this._onResize = null;
		// drop a pending debounced resize so it can't fire after teardown
		if( this._resizeTimer ){
			clearTimeout( this._resizeTimer );
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
	unbind( name, cb ){
		if( !name ) return this.undelegateEvents();
		var listeners = this._delegateEvents || [];
		var remaining = [];
		for( var i = 0; i < listeners.length; i++ ){
			var listener = listeners[i];
			if( listener.type === name && ( !cb || listener.handler === cb ) ){
				if( this.el ) this.el.removeEventListener( listener.type, listener.handler );
			} else {
				remaining.push( listener );
			}
		}
		this._delegateEvents = remaining;
		// also drop a listener registered directly (not through delegateEvents)
		if( cb && this.el ) this.el.removeEventListener( name, cb );
		return this;
	}

	delegateEvents( events ){
		// merge the class's built-in events (_baseEvents) with the subclass's
		// events, resolved via a getter or own-property (so getters don't throw)
		events = events || _.extend({}, this._baseEvents, _.result(this, 'events'));
		if( !events || !this.el ) return this;
		this.undelegateEvents();
		var self = this;
		var splitter = /^(\S+)\s*(.*)$/;
		Object.keys( events ).forEach(function( key ){
			var method = events[key];
			if( typeof method !== 'function' ) method = self[method];
			if( !method ) return;
			var match = key.match( splitter );
			var type = match[1], selector = match[2];
			// True native delegation: ONE listener per event type on the root
			// element, resolving the selector at dispatch time (so dynamically-
			// added elements are handled too). Replaces the previous approach,
			// which bound jQuery-style namespaced types ("click.delegateEvents<cid>")
			// that native addEventListener never actually fires.
			var handler = function( e ){
				if( !selector ){
					method.call( self, e );
				} else {
					var target = e.target.closest( selector );
					if( target && self.el.contains( target ) ) method.call( self, e, target );
				}
			};
			self.el.addEventListener( type, handler );
			self._delegateEvents.push({ type: type, handler: handler });
		});
		return this;
	}

	undelegateEvents(){
		var listeners = this._delegateEvents || [];
		if( this.el ){
			for( var i = 0; i < listeners.length; i++ ){
				this.el.removeEventListener( listeners[i].type, listeners[i].handler );
			}
		}
		this._delegateEvents = [];
		return this;
	}

	// Element
	setElement( element ){
		this.undelegateEvents();
		this._setElement(element);
		this.delegateEvents();
		return this;
	}

	// TODO: internal method to do more than just save the element
	_setElement( el ){
		this.el = el;
	}

/*
	unbind( types, fn ) {
		return this.off( types, null, fn );
	}
*/

	// States
	// Source: https://github.com/makesites/backbone-states

	initStates(){
		// resolve states from the class built-ins (_baseStates) + the subclass
		// (getter/own-property) + any passed via options, without assigning
		// `this.states` (so subclass getters don't throw). Uses native Object.assign
		// (not `_`) because this runs at module load for the history singleton,
		// before the `_` utils instance exists.
		var states = Object.assign({}, this._baseStates, this.states, this._optionStates);
		for( var e in states ){
			var method = states[e];
			if( typeof this[method] === 'function' ) this.bind( e, this[method].bind(this) );
		}
	}
}

/*
 * Router & History
 * Native replacement for Backbone.Router / Backbone.History (zero jQuery)
 * Copyright © Makesites.org
 */

// Cached regular expressions for matching named param parts and splatted
// parts of route strings.
const optionalParam = /\((.*?)\)/g;
const namedParam    = /(\(\?)?:\w+/g;
const splatParam    = /\*\w+/g;
const escapeRegExp  = /[-{}[\]+?.,\\^$|#\s]/g;

// Cached regexes for stripping urls of hash and root.
const routeStripper = /^[#/]|\s+$/g;
const rootStripper  = /^\/+|\/+$/g;
const pathStripper  = /#.*$/;


class Router extends Base {

	constructor( options ){
		// fallback(s)
		options = options || {};
		super( options );
		// events are inherited from Base (on/once/off/trigger/bind)
		// routes can be passed in as an option (merged in _bindRoutes; we never
		// assign `this.routes`, so subclass getters don't throw)
		if( options.routes ) this._optionRoutes = options.routes;
	}

	initialize(){}

	// Bind all defined routes to `history`.
	_bindRoutes(){
		// resolve routes from the subclass (getter/property) + options
		var routes = _.extend({}, _.result( this, "routes" ), this._optionRoutes);
		var route, names = Object.keys( routes );
		if( !names.length ) return;
		while( (route = names.pop()) != null ){
			this.route( route, routes[route] );
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
	route( route, name, callback ){
		if( !(route instanceof RegExp) ) route = this._routeToRegExp( route );
		if( typeof name === "function" ){
			callback = name;
			name = "";
		}
		if( !callback ) callback = this[ name ];
		var self = this;
		history.route( route, function( fragment ){
			var args = self._extractParameters( route, fragment );
			if( self.execute( callback, args, name ) !== false ){
				self.trigger( "route:" + name, args );
				self.trigger( "route", name, args );
				history.trigger( "route", self, name, args );
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
	execute( callback, args, name ){
		if( callback ) callback.apply( this, args );
	}

	/**
	 * Navigate to a URL fragment via history.
	 * @param {string} fragment
	 * @param {{trigger?: boolean, replace?: boolean}} [options]
	 * @returns {this}
	 */
	navigate( fragment, options ){
		history.navigate( fragment, options );
		return this;
	}

	// Convert a route string into a regular expression, suitable for matching
	// against the current location's fragment.
	_routeToRegExp( route ){
		route = route.replace( escapeRegExp, "\\$&" )
			.replace( optionalParam, "(?:$1)?" )
			.replace( namedParam, function( match, optional ){ return optional ? match : "([^/?]+)"; })
			.replace( splatParam, "([^?]*?)" );
		return new RegExp( "^" + route + "(?:\\?([\\s\\S]*))?$" );
	}

	// Given a route, and a URL fragment that it matches, return the array of
	// extracted decoded parameters.
	_extractParameters( route, fragment ){
		var params = route.exec( fragment ).slice( 1 );
		return params.map(function( param, i ){
			// don't decode the search params
			if( i === params.length - 1 ) return param || null;
			return param ? decodeURIComponent( param ) : null;
		});
	}
}


// Handles cross-browser history management, based on either
// [pushState](http://diveintohtml5.info/history.html) and real URLs, or
// [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
// and URL fragments.
class History extends Base {

	constructor(){
		super({});
		// events are inherited from Base (on/once/off/trigger/bind)
		this.handlers = [];
		// ensure that `checkUrl` keeps its context when used as a listener
		this.checkUrl = this.checkUrl.bind( this );
		// ensure history can be used outside of the browser
		if( typeof window !== "undefined" ){
			this.location = window.location;
			this.history = window.history;
		}
	}

	// Are we at the app root?
	atRoot(){
		var path = this.location.pathname.replace(/[^/]$/, "$&/");
		return path === this.root && !this.location.search;
	}

	// Get the cross-browser normalized URL fragment from the hash.
	getHash( win ){
		var match = ( win || this ).location.href.match(/#(.*)$/);
		return match ? match[1] : "";
	}

	// Get the pathname and search params, without the root.
	getFragment( fragment, forcePushState ){
		if( fragment == null ){
			if( this._hasPushState || !this._wantsHashChange || forcePushState ){
				fragment = decodeURI( this.location.pathname + this.location.search );
				var root = this.root.replace(/\/$/, "");
				if( !fragment.indexOf( root ) ) fragment = fragment.slice( root.length );
			} else {
				fragment = this.getHash();
			}
		}
		return fragment.replace( routeStripper, "" );
	}

	// Start monitoring the hash/pushState changes.
	start( options ){
		if( History.started ) throw new Error("history has already been started");
		History.started = true;

		this.options          = _.extend({ root: "/" }, this.options, options);
		this.root             = this.options.root;
		this._wantsHashChange = this.options.hashChange !== false;
		this._wantsPushState  = !!this.options.pushState;
		this._hasPushState    = !!( this.options.pushState && this.history && this.history.pushState );

		var fragment = this.getFragment();

		// normalize the root to always include a leading and trailing slash
		this.root = ( "/" + this.root + "/" ).replace( rootStripper, "/" );

		// depending on whether we're using pushState or hashes, and whether
		// 'onhashchange' is supported, determine how we check the URL state
		if( this._hasPushState ){
			window.addEventListener( "popstate", this.checkUrl );
		} else if( this._wantsHashChange && ("onhashchange" in window) ){
			window.addEventListener( "hashchange", this.checkUrl );
		}

		this.fragment = fragment;

		if( !this.options.silent ) return this.loadUrl();
	}

	// Disable history, perhaps temporarily. Not useful in a real app, but
	// possibly useful for unit testing Routers.
	stop(){
		if( typeof window !== "undefined" ){
			window.removeEventListener( "popstate", this.checkUrl );
			window.removeEventListener( "hashchange", this.checkUrl );
		}
		History.started = false;
	}

	// Add a route to be tested when the fragment changes.
	route( route, callback ){
		this.handlers.unshift({ route: route, callback: callback });
	}

	// Checks the current URL to see if it has changed, and if it has, loads it.
	checkUrl(){
		var current = this.getFragment();
		if( current === this.fragment ) return false;
		this.loadUrl();
	}

	// Attempt to load the current URL fragment.
	loadUrl( fragment ){
		if( !History.started ) return false;
		fragment = this.fragment = this.getFragment( fragment );
		return this.handlers.some(function( handler ){
			if( handler.route.test( fragment ) ){
				handler.callback( fragment );
				return true;
			}
		});
	}

	// Save a fragment into the hash history, or replace the URL state if the
	// 'replace' option is passed. You are responsible for properly URL-encoding
	// the fragment in advance.
	navigate( fragment, options ){
		if( !History.started ) return false;
		if( !options || options === true ) options = { trigger: !!options };

		fragment = this.getFragment( fragment || "" );
		var url = this.root + fragment;
		// strip the fragment of any hash
		fragment = fragment.replace( pathStripper, "" );

		if( this.fragment === fragment ) return;
		this.fragment = fragment;

		// don't include a trailing slash on the root
		if( fragment === "" && url !== "/" ) url = url.slice( 0, -1 );

		if( this._hasPushState ){
			this.history[ options.replace ? "replaceState" : "pushState" ]( {}, document.title, url );
		} else if( this._wantsHashChange ){
			this._updateHash( this.location, fragment, options.replace );
		} else {
			return this.location.assign( url );
		}

		if( options.trigger ) return this.loadUrl( fragment );
	}

	// Update the hash location, either replacing the current entry, or adding a
	// new one to the browser history.
	_updateHash( location, fragment, replace ){
		if( replace ){
			var href = location.href.replace(/(javascript:|#).*$/, "");
			location.replace( href + "#" + fragment );
		} else {
			location.hash = "#" + fragment;
		}
	}
}

// Has the history handling already been started?
History.started = false;

// The global history singleton (mirrors Backbone.history).
var history = new History();


class Model extends Base {

	constructor( model, options={} ) {
		super( options );

		this.attributes = {};
		// change tracking
		this.changed = {};
		this._previousAttributes = {};
		// the attribute that holds the id (subclass may override via get idAttribute())
		if( typeof this.idAttribute === "undefined" ) this.idAttribute = "id";

		// framework option defaults (autofetch/cache) are kept internal, so a
		// subclass `defaults` means ATTRIBUTE defaults (Backbone semantics)
		options = options || {};
		this.options = _.extend({}, this._optionDefaults(), options);

		// seed attributes from the class `defaults` (getter/property); the passed
		// model overrides them
		var attrs = _.extend({}, _.result(this, 'defaults'), (model && typeof model === "object") ? model : {});
		this.set( attrs );

		this.cid = _.uniqueId("model");

		this.initialize();
	}

	// framework option defaults (internal - not the model's attribute `defaults`)
	_optionDefaults(){
		return { autofetch: false, cache: false };
	}

	// initialization
	initialize(){
		// restore cache
		if( this.options.cache ){
			var cache = this.cache();
			if( cache ) this.set( cache );
		}
		// auto-fetch when a url actually resolves. (Testing `this.url` no longer
		// works: since commit 29 every Model inherits a default url() method, so
		// the old guard was always true and autofetch threw
		// `A "url" property or function must be specified` from the constructor.)
		if( this.options.autofetch && _.result(this, 'url') ){
			this._autofetch();
		}
	}

	// autofetch is fire-and-forget: failures are reported through the "error"
	// event that sync() already fires, so the promise rejection is absorbed here
	// rather than surfacing as an unhandled rejection out of a constructor
	_autofetch(){
		var request = this.fetch();
		if( request && typeof request.catch === "function" ) request.catch(function(){});
		return request;
	}

	// Getter/Setter

	// add is like set but only if not available
	add( obj ){
		var self = this;
		var data = {};
		_.each( obj, function( item, key ){
			if( _.isUndefined( self.get(key) ) ){
				data[key] = item;
			}
		});
		this.set( data );
	}

	/**
	 * Get the value of an attribute.
	 * @param {string} attr
	 * @returns {*}
	 */
	get( attr ){
		return this.attributes[attr];
	}

	has( attr ){
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
	set( key, val, options ){
		if (key == null) return this;

		// Handle both `"key", value` and `{key: value}` -style arguments.
		var attrs;
		if (typeof key === 'object') {
			attrs = key;
			options = val;
		} else {
			(attrs = {})[key] = val;
		}

		options = options || {};

		// run validation (only when options.validate); abort on failure
		if( !this._validate( attrs, options ) ) return false;

		var unset = options.unset;
		var silent = options.silent;
		var changes = [];
		var changing = this._changing;
		this._changing = true;

		// snapshot the previous state at the start of a (non-nested) set
		if( !changing ){
			this._previousAttributes = _.extend({}, this.attributes);
			this.changed = {};
		}
		var current = this.attributes;
		var prev = this._previousAttributes;

		// track the id
		if( this.idAttribute in attrs ) this.id = attrs[this.idAttribute];

		// compute changes vs. current, and cumulative changes vs. previous
		for( var attr in attrs ){
			val = attrs[attr];
			if( !_.isEqual( current[attr], val ) ) changes.push( attr );
			if( !_.isEqual( prev[attr], val ) ) this.changed[attr] = val;
			else delete this.changed[attr];
			if( unset ) delete current[attr]; else current[attr] = val;
		}

		// fire granular change:<attr> events, then a single change (once, even for
		// nested sets, via _pending)
		if( !silent ){
			if( changes.length ) this._pending = options;
			for( var i = 0; i < changes.length; i++ ){
				this.trigger( 'change:' + changes[i], this, current[changes[i]], options );
			}
		}

		if( changing ) return this;
		if( !silent ){
			while( this._pending ){
				options = this._pending;
				this._pending = false;
				this.trigger( 'change', this, options );
			}
		}
		this._pending = false;
		this._changing = false;
		return this;
	}

	// Validation
	// - override validate(attrs, options) to return an error to block set/save
	_validate( attrs, options ){
		if( !options.validate || !this.validate ) return true;
		attrs = _.extend({}, this.attributes, attrs);
		var error = this.validationError = this.validate( attrs, options ) || null;
		if( !error ) return true;
		this.trigger( 'invalid', this, error, _.extend({}, options, { validationError: error }) );
		return false;
	}

	// Change tracking

	hasChanged( attr ){
		if( attr == null ) return !_.isEmpty( this.changed );
		return this.changed ? ( attr in this.changed ) : false;
	}

	changedAttributes( diff ){
		if( !diff ) return this.hasChanged() ? _.extend({}, this.changed) : false;
		var old = this._previousAttributes;
		var changed = {}, has = false;
		for( var attr in diff ){
			if( _.isEqual( old[attr], diff[attr] ) ) continue;
			changed[attr] = diff[attr];
			has = true;
		}
		return has ? changed : false;
	}

	previous( attr ){
		if( attr == null || !this._previousAttributes ) return null;
		return this._previousAttributes[attr];
	}

	previousAttributes(){
		return _.extend({}, this._previousAttributes);
	}

	// #63 reset model to its (attribute) default values
	reset(){
		return this.clear().set( _.result(this, 'defaults') );
	}

	// remove all attributes from the model (firing "change")
	clear( options ){
		options = options || {};
		this.attributes = {};
		if( !options.silent ) this.trigger("change", this, options);
		return this;
	}

	// Cache
	// localStorage-backed cache (see cache.js). Call with data to store it, or
	// with no argument to retrieve it. Configure via options.cacheOptions:
	// { cache_key, cache_exclude:[], cache_timestamp }.
	cache( data ){
		// no usable storage engine (SSR, private mode, blocked site data)
		if( !store.available() ) return false;
		var opts = ( this.options && this.options.cacheOptions ) || {};
		var name = opts.cache_key || this.name || "model";
		// SET
		if( data ){
			// namespace by id when available
			if( data[this.idAttribute] ) name += "_" + data[this.idAttribute];
			// clone so we don't mutate the source object
			var payload = _.extend({}, data);
			// exclude configured keys
			var exclude = opts.cache_exclude || [];
			for( var i = 0; i < exclude.length; i++ ) delete payload[ exclude[i] ];
			var value = JSON.stringify( payload );
			// optionally base64-wrap with a timestamp
			if( opts.cache_timestamp ){
				value = btoa( value );
				value = JSON.stringify({ data: value, timestamp: Date.now() });
			}
			return store.set( name, value );
		}
		// GET
		if( this.get(this.idAttribute) ) name += "_" + this.get(this.idAttribute);
		var cached = store.get( name );
		if( !cached ) return false;
		cached = JSON.parse( cached );
		if( opts.cache_timestamp ) cached = JSON.parse( atob( cached.data ) );
		return cached;
	}

	// Sync
	// - proxy to the native fetch()-based sync (see sync.js)

	sync( method, model, options ){
		return sync( method, model, options );
	}

	// Default URL: `urlRoot` (or the owning collection's url) + "/" + id.
	// Override with a `url` string/getter, or a `urlRoot` string/getter.
	url(){
		var base = _.result( this, 'urlRoot' ) || ( this.collection && _.result( this.collection, 'url' ) ) || null;
		if( !base ) return null;
		if( this.isNew() ) return base;
		return base.replace(/\/$/, "") + "/" + encodeURIComponent( this.get( this.idAttribute ) );
	}

	// a model is considered "new" until it has been assigned an id
	isNew(){
		return !this.has( this.idAttribute );
	}

	/**
	 * Fetch the model from the server (GET) and apply the response.
	 * @param {SyncOptions} [options]
	 * @returns {Promise<*>}
	 */
	fetch( options ){
		options = options || {};
		var self = this;
		var success = options.success;
		options.success = function( resp ){
			var data = self.parse( resp, options );
			self.set( data, options );
			if( success ) success.call( options.context, self, resp, options );
			self.trigger("sync", self, resp, options);
		};
		return this.sync("read", this, options);
	}

	/**
	 * Save the model to the server (POST when new, else PUT/PATCH).
	 * @param {Object} [attrs] - attributes to set before saving
	 * @param {SyncOptions} [options]
	 * @returns {Promise<*>}
	 */
	save( attrs, options ){
		options = options || {};
		// validate by default on save
		if( options.validate === undefined ) options.validate = true;
		// optimistically set the attributes locally (abort if invalid)
		if( attrs ){
			if( !this.set( attrs, options ) ) return false;
		} else if( !this._validate({}, options) ){
			return false;
		}
		var self = this;
		var success = options.success;
		options.attrs = options.attrs || this.toJSON();
		options.success = function( resp ){
			var data = self.parse( resp, options );
			if( data ) self.set( data, options );
			if( success ) success.call( options.context, self, resp, options );
			self.trigger("sync", self, resp, options);
		};
		var method = this.isNew() ? "create" : ( options.patch ? "patch" : "update" );
		return this.sync( method, this, options );
	}

	// delete the model from the server
	destroy( options ){
		options = options || {};
		var self = this;
		var success = options.success;
		var destroy = function(){
			self.trigger("destroy", self, self.collection, options);
		};
		options.success = function( resp ){
			if( options.wait ) destroy();
			if( success ) success.call( options.context, self, resp, options );
			if( !self.isNew() ) self.trigger("sync", self, resp, options);
		};
		// nothing persisted on the server yet
		if( this.isNew() ){
			if( !options.wait ) destroy();
			options.success();
			return false;
		}
		if( !options.wait ) destroy();
		return this.sync("delete", this, options);
	}

	// Events are inherited from Base (on/once/off/trigger/bind).

	// Helper functions
	// - check if the app is online
	// `app` is a global published by the APP facade; referencing it directly
	// threw a ReferenceError whenever no app had been instantiated (or outside a
	// browser), because `_.isUndefined(app)` still evaluates `app`. Only `typeof`
	// is safe on an undeclared identifier.
	isOnline(){
		return ( typeof app !== "undefined" && app && app.state ) ? app.state.online : true;
	}

	getValue (object, prop) {
		if (!(object && object[prop])) return null;
		return _.isFunction(object[prop]) ? object[prop]() : object[prop];
	}

	parse( data ){
		var self = this;
		setTimeout(function(){ self.trigger("fetch"); }, 200); // better way to trigger this after parse?
		// cache response
		if( this.options.cache ){
			this.cache( data );
		}
		return data;
	}

	toJSON( options ){
		var obj = this.attributes;
		if (typeof obj !== 'object') return obj;
		return ( Array.isArray(obj) ) ? obj.slice() : _.extend({}, obj);
	}

	// extract data (and possibly filter keys)
	output(){
		// in most cases it's a straight JSON output
		return this.toJSON();
	}

}


class View extends Base {

	constructor( options ){
		// fallback(s)
		options = options || {};
		//
		super( options );
		// element
		this.el = this._getEl( options );
		// data sources. The Backbone-style `model` / `collection` options were
		// read here but never assigned, so `this.model` was always undefined:
		// `new View({ model })` bound to nothing and `this.model.get(...)` inside
		// a subclass render() threw. Assign them (skipping any subclass accessor,
		// which cannot be written to), then resolve `data` as before.
		if( options.model && _.assignable( this, 'model' ) ) this.model = options.model;
		if( options.collection && _.assignable( this, 'collection' ) ) this.collection = options.collection;
		this.data = options.data || this.model || this.collection || null;
		// containers
		//var state = Backbone.View.prototype.state || new Backbone.Model();
		this.state = new Model();
		// defaults
		this.state.set({
			loaded : false,
			scroll : false,
			visible : false
		});
		// built-in state machine + events. Kept as _base* so they merge with a
		// subclass's states/events (getter or property) without being clobbered -
		// and so subclass getters don't collide with a constructor assignment.
		this._baseStates = {
			"scroll": "_scroll"
		};
		this._baseEvents = {
			"click a[rel='external']" : "clickExternal"
		};

		// view option defaults (a subclass may override via get defaults())
		var defaults = _.extend({}, this._viewDefaults(), _.result(this, 'defaults'));

		//  extend options
		this.options = _.extend({}, defaults, options);
		// flags
		this.options.data  = !_.isNull( this.data );

		this.cid = _.uniqueId("view");

		this.initialize();
	}

	initialize(){
		var self = this;
		// unbind this container from any previous listeners
		this.unbind();
		//
		//_.bindAll(this, 'render', 'clickExternal', 'postRender', 'onLoaded', '_url', '_inDOM', '_toJSON', '_onLoaded');
		//if( typeof this.url == "function" ) _.bindAll(this, 'url');
		//
		this.on('loaded', this._onLoaded.bind(this) );
		this.on('loaded', this.onLoaded.bind(this) );

		// #9 optionally add a reference to the view in the container
		if( this.options.attr ) {
			this.el.setAttribute("data-view", this.options.attr );
		} else {
			this.el.removeAttribute("data-view");
		}
		// compile
		var html = ( this.options.html ) ? this.options.html : null;
		// considering url as a flat option (check for string?)
		if( this.url && !this.options.url) this.options.url = this.url;
		// include init options in url()
		var url = this._url( this.options );
		// proxy internal method for future requests - unless the subclass declared
		// its own `url` accessor, which cannot be assigned over
		if( _.assignable( this, 'url' ) ) this.url = this._url;
		// supporting custom templates
		let TMPL = ( this.options.template ) ? this.options.template : Template;

		// set the type to default (as the Template expects)
		if( !this.options.type ) this.options.type = "default";
		this.template = (typeof TMPL == "function") ? new TMPL(html, { url : url }) : TMPL;
		// re-render when the template loads (tracked so remove() cleans it up)
		if( self.options.autoRender && this.template.on ) this.listenTo(this.template, "loaded", this.render);

		// add listeners (tracked via listenTo so remove() tears them down)
		if( this.options.data && !_.isUndefined( this.data.on ) ){
			this.listenTo( this.data, this.options.bind, this.render );
		}
		// #11 : initial render only if data is not empty (or there are no data)
		if( this._initRender() ){
			this.render();
		} else {
			this.trigger("loaded");
		}
		// #36 - Adding resize event. Keep the bound handler: removeEventListener
		// matches by identity, so the teardown in Base#remove() could never
		// remove an inline .bind(this) and every removed view leaked a listener
		// (and, through it, the whole view).
		this._onResize = this._resize.bind(this);
		if( typeof window !== "undefined" ) window.addEventListener("resize", this._onResize );
		// monitor viewport visibility natively (replaces the jQuery scroll math)
		this._setupVisibilityObserver();

		this.initStates();
		// initiate parent (states etc.)
		//return Backbone.View.prototype.initialize.call( this, options );
		//return View.prototype.initialize.call(this, options);
	}

	// built-in view option defaults (merged under any subclass get defaults()).
	// initStates() is now inherited from Base (resolve-merge of _baseStates).
	_viewDefaults(){
		return {
			data : false,
			html: false,
			template: false,
			url : false,
			bind: "add remove reset change",
			type: false,
			parentEl : false,
			autoRender: true,
			inRender: false,
			silentRender: false,
			renderTarget: false,
			resizeDelay: 1000
		};
	}

	// parse URL in runtime (optionally)
	_url( options ){
		// fallback
		options = options || {};
		var url = options.url || this.options.url;
		return (typeof url == "function")? url() : url;
	}

	preRender(){
	}

	/**
	 * Render the view's template into its element (or renderTarget). Override for
	 * custom rendering.
	 * @returns {void}
	 */
	render(){
		// prerequisite
		if( !this.template ) return;
		// execute pre-render actions
		this._preRender();
		//
		var template = this._getTemplate();
		var data = this.toJSON();
		// checking instance of template before executing as a function
		var html = ( template instanceof Function ) ? template( data ) : template;
		// nothing compiled yet (no `html` / `url` option) - there is no markup to
		// insert, and blanking the element would destroy its existing content.
		// Subclasses that override render() are unaffected.
		if( html == null ) return this._postRender();
		// find the render target
		var container = this._findContainer();
		// saving element reference
		if( !this.el ){
			this.el = html; // convert to a Node?
		}
		// make sure the element is attached to the DOM
		this._inDOM();
		// ways to insert the markup
		if( this.options.append ){
			container.append( this.el );
		} else if( this.options.prepend ){
			container.prepend( this.el );
		} else {
			container.innerHTML = html;
		}

		//container.attachShadow({ mode: 'open'}).appendChild(template.content.cloneNode(true))
		// execute post-render actions

		this._postRender();
	}

	postRender(){
	}

	// a more discrete way of binding events triggers to objects
	listen( obj, event, callback ){
		// adds event listeners to the data (tracked via listenTo for cleanup)
		var e = ( typeof event == "string")? [event] : event;
		for( var i in e ){
			this.listenTo(obj, e[i], callback);
		}

	}

	resize( e ){
		// override with your own custom actions...
	}

	clickExternal(e){
		e.preventDefault();
		var url = this.findLink(e.target);
		// track the click with Google Analytics (if available)
		if(typeof pageTracker != "undefined") url = pageTracker._getLinkerUrl(url);
		// #22 - Looking for Phonegap ChildBrowser in external links
		try{
			window.plugins.childBrowser.showWebPage( url );
		} catch( exp ){
			// revert to the redular load
			window.open(url, '_blank');
		}
		return false;
	}

	// attach to an event for a tab like effect
	clickTab(e){
		e.preventDefault();
		let section = this.findLink(e.target);
		let sectionEl = this.el.querySelector( section );
		sectionEl.style.display = 'block';
		var siblings = _.getSiblings( sectionEl );
		siblings.forEach( (sibling) => (sibling.style.display = 'none') );
		// optionally add selected class if the link sits in a list item
		var li = e.target.closest("li");
		if( li ){
			li.classList.add("selected");
			_.getSiblings( li ).forEach( function( sibling ){ sibling.classList.remove("selected"); });
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

	toJSON(){
		var data = this._toJSON();
		// #43 - adding options to the template data
		return ( this.options.inRender ) ? { data : data, options: this.options } : data;
	}

	onLoaded(){
		// replace with your own actions on load
	}

	// Helpers

	// call methods from the parent
	parent( method, options ){
		// fallbacks
		method = method || "";
		options = options || {};
		// prerequisites
		this.__inherit = this.__inherit || []; // use promises instead?
		// check what reference of the parent we have available
		// - first is to stop recursion, second is to support for Backbone.APP
		var parent = this.__inherit[method] || this._parent || {};
		// fallback to pure js inheritance
		var proto = parent.prototype || (Object.getPrototypeOf(this)).constructor.__super__; // last MUST exist...
		// else View.__super__ ?
		var fn = proto[method] || function(){
			// reset inheritance
			delete this.__inherit[method];
		}; // fallback necessary?
		// convert arguments to an array
		var args = (options instanceof Array) ? options: [options];
		// stop recursion by saving a reference to the next parent
		this.__inherit[method] = proto._parent || function(){};
		//
		return fn.apply(this, args);
	}

	// Internal methods
	_getEl( options ){
		var el = options.el || document.createElement("div");
		//lookup element
		if(typeof el == "string") el = document.querySelector( el );

		return el;
	}


	// - render

	_initRender(){
		if( !this.options.autoRender ) return false;
		// variables
		var template = this._getTemplate();
		var hasMarkup = (this.options.html || ( this.options.url && template ) );
		var hasData = (this.options.data && ( _.isUndefined( this.data.toJSON ) || ( !_.isUndefined( this.data.toJSON ) && !_.isEmpty(this.data.toJSON()))));
		// if there's data and markup available, render
		if( hasMarkup && hasData ) return true;
		// if there's only one or the other render
		if( hasMarkup && !this.options.data) return true;
		if( hasData && !this.options.url ) return true;
		// in all other cases, don't render
		return false;
	}

	_preRender(){
		// app-specific actions
		this.preRender();
	}

	_postRender(){
		// make sure the container is presented
		if( !this.options.silentRender ) this.el.style.display = 'block';
		// remove loading state (if data has arrived)
		if( !this.options.data || (this.options.data && !_.isEmpty(this._toJSON()) ) ){
			this.el.classList.remove("loading");
			// set the appropriate flag
			this.state.set("loaded", true);
			// bubble up the event
			this.trigger("loaded");
		}
		// app-specific actions
		this.postRender();
	}

	// get the JSON of the data
	_toJSON(){
		if( !this.options.data ) return {};
		if( this.data.toJSON ) return this.data.toJSON();
		return this.data; // in case the data is a JSON...
	}

	_getTemplate(){
		return ( this.options.type ) ? this.template.get( this.options.type ) : this.template;
	}

	_onLoaded(){
		this.setElement( this.el );
	}

	// - container is defined in three ways
	// * renderTarget is the element
	// * renderTarget inside the element
	// * renderTarget outside the element (bad practice?)
	_findContainer(){
		var target = this.options.renderTarget;
		// by default the view renders into its own element
		if( !target ) return this.el;
		// an element was handed in directly
		if( typeof target !== "string" ) return target;
		// a selector: prefer a match inside the view's element, then fall back to
		// the document.
		//
		// (The previous version tested `container.length` on the *Element*
		// returned by querySelectorAll(...)[0]. An Element has no `length`, so an
		// in-element match was always discarded in favour of the document-wide
		// lookup - the documented "renderTarget inside the element" case never
		// worked - and a miss threw `Cannot read properties of undefined`.)
		var container = this.el ? this.el.querySelector( target ) : null;
		if( !container && typeof document !== "undefined" ) container = document.querySelector( target );
		// nothing matched anywhere: render into the view's own element rather
		// than throwing out of render()
		return container || this.el;
	}

	// checks if an element exists in the DOM
	_inDOM( el ){
		// fallbacks
		el = el || this.el;
		// prerequisites
		if( !el ) return false;
		// variables
		var parent = document.querySelector( (this.options.parentEl || "body") );
		// check parent element
		var exists = parent.contains( el );
		if( exists ) return true;
		// el not in parent el
		if( this.options.parentPrepend ){
			parent.prepend( el );
		} else {
			parent.append( el );
		}
	}

	// - When navigate is triggered
	_navigate( e ){
		// extend method with custom logic
	}

	// resize event trigger (debounced)
	// The timer has to live on the instance: it used to be a local `var timeout`,
	// so `clearTimeout( timeout )` always cleared `undefined` and every single
	// resize event scheduled its own callback - no debouncing at all.
	_resize () {
		var self = this;
		var args = Array.prototype.slice.call( arguments );
		var delay = ( this.options && this.options.resizeDelay ) || 1000;
		clearTimeout( this._resizeTimer );
		this._resizeTimer = setTimeout( function () {
			self._resizeTimer = null;
			self.resize.apply( self, args );
		}, delay );
	}

	//
	_scroll() {
		//this.state.set("scroll", true);
	}

	// checks if the view is visible
	// (state is maintained natively by the IntersectionObserver below)
	isVisible(){
		return this.state.get("visible");
	}

	// - visibility monitoring via the native IntersectionObserver API.
	// Replaces the expensive jQuery scroll/offset math: the browser delegates
	// this to the compositor thread at effectively zero main-thread cost, and
	// emits "visible"/"hidden" as the element enters/leaves the viewport.
	_setupVisibilityObserver(){
		if( typeof IntersectionObserver === "undefined" || !this.el ) return;
		var self = this;
		this.observer = new IntersectionObserver(function( entries ){
			entries.forEach(function( entry ){
				var visible = entry.isIntersecting;
				if( visible !== self.state.get("visible") ){
					self.state.set("visible", visible);
					self.trigger( visible ? "visible" : "hidden" );
				}
			});
		});
		this.observer.observe( this.el );
	}

	/**
	 * Tear the view down: drop all listenTo bindings, stop the visibility
	 * observer, and detach the element from the DOM.
	 * @returns {this}
	 */
	remove(){
		// remove all listenTo bindings (data, template, ...) to avoid leaks
		this.stopListening();
		// drop the delegated DOM listeners too, so a re-used element is clean
		this.undelegateEvents();
		if( this.observer ) this.observer.disconnect();
		if( this.el && this.el.parentNode ) this.el.parentNode.removeChild( this.el );
		// let Base remove the resize listener etc.
		super.remove();
	}

}


class Controller extends Router {

	constructor( options ) {
		// fallback(s) - must run before super()
		options = options || {};
		// inherit the native Router/History routing engine
		super( options );

		this.data = new Model();

		// app config refered to as options: the framework's built-in defaults,
		// then a subclass `defaults` (getter or property), then the caller's
		// options. (The built-ins used to be assigned to `this.defaults`, so a
		// subclass declaring `get defaults()` threw in the constructor.)
		options = options || {};
		this.options = _.extend({}, this._optionDefaults(), _.result(this, 'defaults'), options);

		// built-in routes, merged UNDER any subclass routes at bind time (see
		// _bindRoutes). Kept as _baseRoutes so a subclass can declare `get routes()`
		// without colliding with a constructor assignment.
		this._baseRoutes = {
			"": "index",
			"_=_": "_fixFB",
			"access_token=:token": "access_token",
			"logout": "logout"
			//"*path"  : "_404"
		};

		// app reference + shared environment state. Owned by the APP facade;
		// falls back to a standalone state object when used without APP.
		this.app = options.app || null;
		this.state = this.app ? this.app.state : createState();

		this.cid = _.uniqueId("controller");

		this.initialize();

	}

	// framework option defaults, kept internal so a subclass can declare
	// `get defaults()` (mirrors Model#_optionDefaults / Collection#_optionDefaults)
	_optionDefaults(){
		return {
			api : false,
			autostart: true,
			location : false,
			pushState: false,
			p404 : "/"
		};
	}

	initialize(){
		// setup app
		this._setup();
		// bind the declared routes to the native history engine
		this._bindRoutes();
		// start monitoring the URL for changes
		if( this.options.autostart && typeof window !== "undefined" ) history.start({ pushState: this.options.pushState });
	}

	update(){
		// backwards compatibility for a simple state object
		var scroll = (this.state instanceof Model ) ? this.state.get("scroll") : this.state.scroll;
		if( scroll ){
			document.body.classList.remove("no-scroll");
		} else {
			document.body.classList.add("no-scroll");
		}
	}

	// Routes
	// default route - override with custom method
	index(){

	}

	// vanilla logout route
	logout(){
		if( this.session ) this.session.trigger("logout", { reload: true });
		// back to the homepage
		this.navigate("/", true);
	}

	// this method wil be executed before "every" route!
	preRoute( options, callback ){
		var self = this;
		// execute logic here:
		// - check if there is a session
		if( this.session && (typeof this.session.state !== "undefined") ){
			// wait for the session
			if( !this.session.state ){
				return this.session.bind("loaded", _.once(function(){
					callback.apply(self, options);
				}) );
			} else {
				// session available...
				return callback.apply(self, options);
			}
		}
		return callback.apply(self, options);
	}

	access_token( token ){
		// if there's an app session, save it there
		if( this.session ){
			this.session.set({ "token" : token });
		} else {
			// set as a global var (for later use)
			window.access_token = token;
		}
		// either way redirect back to home...
		this.navigate("/", true);
	}

	// - internal
	// collection of setup methods
	_setup(){
		// using options as the main configuration source
		// - use an API URL
		if( this.options.api ) this._ajaxPrefilter( this.options.api );
		// - init analytics
		//this.bind('all', this._trackPageview);
		//this.bind('all', this._layoutUpdate);

		// - monitor user's location
		if( this.options.location ){
			this._geoLocation();
		}
		// - keep the online/offline state in sync
		this._setupConnectivity();
		// - intercept internal links for SPA navigation (when using pushState)
		if( this.options.pushState ) this._setupLinks();
		// - setup session
		this._setupSession();
	}

	// keep state.online in sync with the browser connectivity, emitting
	// "online"/"offline" so the app can react (replaces UA/navigator polling)
	_setupConnectivity(){
		if( typeof window === "undefined" ) return;
		var self = this;
		window.addEventListener("online", function(){
			self.state.online = true;
			self.trigger("online");
		});
		window.addEventListener("offline", function(){
			self.state.online = false;
			self.trigger("offline");
		});
	}

	// intercept clicks on internal links and route them through history,
	// avoiding full-page reloads (native port of the legacy layout _clickLink)
	_setupLinks(){
		if( typeof document === "undefined" ) return;
		var self = this;
		document.body.addEventListener("click", function( e ){
			var link = e.target.closest("a");
			if( !link ) return;
			var href = link.getAttribute("href");
			// ignore external links, new-tab links, in-page anchors and absolute urls
			var external = link.getAttribute("rel") === "external" || link.getAttribute("target");
			if( !href || external || href.charAt(0) === "#" || /^https?:\/\//.test(href) ) return;
			// only handle root-relative internal paths
			if( href.charAt(0) !== "/" ) return;
			e.preventDefault();
			self.navigate( href, { trigger: true } );
		});
	}

	// - setup session: reuse the app-owned session, or create one when
	//   configured standalone (opt-in via options.session)
	_setupSession(){
		if( this.app && this.app.session ){ this.session = this.app.session; return; }
		if( !this.options.session ) return;
		var SessionClass = APP.Session || Session;
		if( SessionClass ) this.session = new SessionClass( {}, this.options.session );
	}

	// set the api base url (+ credentials + CSRF) for all sync requests
	// native replacement for the old jQuery $.ajaxPrefilter
	_ajaxPrefilter( api ){
		var self = this;
		configureSync({
			// prepend the API base to relative URLs
			base: api,
			// send cookies (servers that set Access-Control-Allow-Credentials: true)
			credentials: "include",
			// attach the CSRF token from the session, when available
			headers: function(){
				var session = self.session || false;
				var csrf = ( session ) ? ( session._csrf || session.get('_csrf') || false ) : false;
				return csrf ? { "X-CSRF-Token": csrf } : {};
			}
		});
	}

	// addressing the issue: http://stackoverflow.com/q/7131909
	_fixFB(){
		this.navigate("/", true);
	}

	_layoutUpdate(path){
		//update the layout
		if(this.layout) this.layout.trigger("update", { navigate : true, path : path });
	}

	// - overriding default _bindRoutes
	_bindRoutes(){
		// resolve routes: built-ins + subclass (getter/property) + options,
		// without assigning `this.routes` (so subclass getters don't throw)
		var routes = _.extend({}, this._baseRoutes, _.result(this, 'routes'), this._optionRoutes);
		var route, names = Object.keys(routes);
		while(typeof (route = names.pop()) !== "undefined"){
			var name = routes[route];
			// when we find the route we execute the preRoute
			// with a reference to the route as a callback...
			this.route(route, name, this._callRoute( this[name] ) );
		}
	}

	// special execution of a route (with pre-logic)
	_callRoute( route ){
		return function(){
				this.preRoute.call(this, arguments, route);
			};
	}

	_geoLocation(){
		var self = this;
		// get user's location
		navigator.geolocation.getCurrentPosition(
			function( data ){ self.state.location = data; },
			function(){ console.log("error", arguments); }
		);
		// update every 30 sec (to support mobile)
		setTimeout( function(){
			self._geoLocation();
		}, 30000);

	}

	// Fallback 404 route
	_404( path ){
		var msg = "Unable to find path: " + path;
		console.log(msg);
		// redirect to 404 path
		this.navigate( this.options.p404 );
	}

}


class Collection extends Base {

	constructor( models, options={} ) {
		super( options );

		// the "item" of the collection: passed on instantiation, declared by a
		// subclass (`get model(){ return Book; }` — Backbone's canonical form), or
		// the base Model. Assigned only when the name is writable: assigning over
		// a subclass accessor throws in strict mode, which made the idiomatic
		// declaration impossible.
		var ModelClass = options.model || this.model || Model;
		if( _.assignable( this, 'model' ) ) this.model = ModelClass;

		// the internal data array + the id/cid index
		this._reset();

		// merge options: the framework's built-in option defaults, then a
		// subclass `defaults` (getter or property), then the caller's options
		options = options || {};
		this.options = _.extend( {}, this._optionDefaults(), _.result(this, 'defaults'), options );
		// optional comparator (a subclass may also define get comparator())
		if( options.comparator !== undefined ) this._comparator = options.comparator;

		this.cid = _.uniqueId("collection");

		this.initialize( models, options );
		// populate from the passed models (silently, at construction)
		if( models ) this.reset( models, { silent: true } );
	}

	// framework option defaults, kept internal (mirrors Model#_optionDefaults and
	// View#_viewDefaults) so a subclass is free to declare `get defaults()` — the
	// constructor used to assign `this.defaults`, which threw over a getter
	_optionDefaults(){
		return { _synced: false, autofetch: false, cache: false };
	}

	// (re)initialise the internal store: the data array + the id/cid index.
	// The index is a null-prototype object so that ids colliding with
	// Object.prototype members ("constructor", "toString", ...) can't resolve to
	// an inherited value instead of a model.
	_reset(){
		this.data = [];
		this._byId = Object.create( null );
	}

	// initialization hook (override freely)
	initialize( models, options ){
		// restore cache
		if( this.options.cache ){
			var cache = this.cache();
			if( cache ) this.add( cache );
		}
		// auto-fetch if no models are passed (and a url actually resolves)
		if( this.options.autofetch && _.isEmpty(models) && _.result(this, 'url') ){
			this._autofetch();
		}
	}

	// see Model#_autofetch - fire-and-forget, failures surface as "error" events
	_autofetch(){
		var request = this.fetch();
		if( request && typeof request.catch === "function" ) request.catch(function(){});
		return request;
	}
/*
	render(){

	}
*/
	update(){

	}

	/**
	 * Add one or many models/objects (deduped by id via set()). Fires "add".
	 * @param {(Object|Model|Array)} models
	 * @returns {(Model|Array)}
	 */
	add( models, options ){
		return this.set( models, _.extend({ merge: false }, options, { add: true, remove: false }) );
	}

	/**
	 * The "smart" update: add new models, merge existing ones (matched by id) and
	 * remove any not present in `models`. Options { add, remove, merge, sort,
	 * silent } (all default true except silent). Fires add / remove / sort / update.
	 * @param {(Object|Model|Array)} models
	 * @returns {(Model|Array)}
	 */
	set( models, options ){
		if( models == null ) return this;
		options = _.extend({ add: true, remove: true, merge: true }, options );
		var singular = !Array.isArray( models );
		var list = singular ? [ models ] : models.slice();

		var toAdd = [], keep = {};

		for( var i = 0; i < list.length; i++ ){
			var item = list[i];
			var id = this._idOf( item );
			// match an existing member by cid (same instance) or by id
			var existing = ( item && item.cid && this._byId[ item.cid ] ) || ( ( id != null ) ? this._byId[ id ] : null );
			if( existing ){
				// merge the incoming attributes into the existing model
				if( options.merge && item !== existing ){
					existing.set( item.attributes ? item.attributes : item, options );
				}
				keep[ existing.cid ] = true;
			} else if( options.add ){
				var model = this._prepareModel( item, options );
				// index the new model straight away so a duplicate later in the
				// SAME batch matches it (the full _addReference runs after the
				// removal pass, which would otherwise be too late to dedupe)
				this._index( model );
				toAdd.push( model );
				keep[ model.cid ] = true;
			}
		}

		// removals: existing models not present in the incoming set
		var removed = [];
		if( options.remove ){
			for( var j = this.data.length - 1; j >= 0; j-- ){
				var m = this.data[j];
				if( !keep[ m.cid ] ){
					this.data.splice( j, 1 );
					this._removeReference( m );
					removed.push( m );
				}
			}
		}

		// additions
		for( var k = 0; k < toAdd.length; k++ ){
			this.data.push( toAdd[k] );
			this._addReference( toAdd[k] );
		}

		// keep sorted when a comparator is set and models were added
		var sorted = false;
		if( ( this.comparator || this._comparator ) && toAdd.length && options.sort !== false ){
			this.sort({ silent: true });
			sorted = true;
		}

		// events
		if( !options.silent ){
			for( var a = 0; a < toAdd.length; a++ ) this.trigger( "add", toAdd[a], this, options );
			for( var r = 0; r < removed.length; r++ ) this.trigger( "remove", removed[r], this, options );
			if( sorted ) this.trigger( "sort", this, options );
			if( toAdd.length || removed.length ) this.trigger( "update", this, options );
		}

		var firstId = this._idOf( list[0] );
		return singular ? ( toAdd[0] || ( firstId != null ? this._byId[ firstId ] : null ) ) : this.data;
	}

	// resolve the id of a model instance or a plain attributes object
	_idOf( item ){
		if( item == null ) return undefined;
		if( item.cid && item.get ) return item.get( item.idAttribute );
		var idAttr = ( this.model && this.model.prototype && this.model.prototype.idAttribute ) || "id";
		return item[ idAttr ];
	}

	// wrap plain attributes in this.model (or return an existing model)
	_prepareModel( attrs, options ){
		if( attrs && attrs.cid && attrs.get ) return attrs;
		return new this.model( attrs, options );
	}

	/**
	 * Sort by the comparator (function(model)->key, function(a,b)->number, or an
	 * attribute-name string). Fires "sort".
	 * @returns {this}
	 */
	sort( options ){
		var comparator = this.comparator || this._comparator;
		if( !comparator ) return this;
		options = options || {};
		var self = this;
		if( typeof comparator === "string" ){
			this.data.sort(function( a, b ){
				var av = a.get( comparator ), bv = b.get( comparator );
				return ( av < bv ) ? -1 : ( av > bv ) ? 1 : 0;
			});
		} else if( comparator.length === 1 ){
			this.data.sort(function( a, b ){
				var av = comparator.call( self, a ), bv = comparator.call( self, b );
				return ( av < bv ) ? -1 : ( av > bv ) ? 1 : 0;
			});
		} else {
			this.data.sort( comparator.bind( this ) );
		}
		if( !options.silent ) this.trigger( "sort", this, options );
		return this;
	}

	/**
	 * Remove a model - accepts a model, an id, or a cid. Fires "remove".
	 * @param {(Model|string|number|Array)} target
	 * @returns {?Model}
	 */
	remove( target, options ){
		options = options || {};
		if( Array.isArray( target ) ){
			var self = this;
			return target.map(function( t ){ return self.remove( t, options ); });
		}
		var model = ( target && target.cid ) ? target : this.get( target );
		if( !model ) return null;
		var index = this.data.indexOf( model );
		if( index > -1 ) this.data.splice( index, 1 );
		this._removeReference( model );
		if( !options.silent ) this.trigger( "remove", model, this, options );
		return model;
	}

	/**
	 * Replace all models at once, firing a single "reset".
	 * @param {Array} [models]
	 * @returns {this}
	 */
	reset( models, options ){
		options = options || {};
		for( var i = 0; i < this.data.length; i++ ) this._removeReference( this.data[i] );
		options.previousModels = this.data;
		this._reset();
		if( models ) this.add( models, _.extend({}, options, { silent: true }) );
		this.options._synced = true;
		if( !options.silent ) this.trigger( "reset", this, options );
		return this;
	}

	// index a model by cid and by id (both point at the same model)
	_index( model ){
		if( !model ) return;
		if( model.cid ) this._byId[ model.cid ] = model;
		var id = model.get ? model.get( model.idAttribute || "id" ) : null;
		if( id != null ) this._byId[ id ] = model;
	}

	// maintain the id/cid index + a back-reference, and forward the model's events
	_addReference( model ){
		if( !model ) return;
		this._index( model );
		if( !model.collection ) model.collection = this;
		if( model.on ) model.on( "all", this._onModelEvent, this );
	}
	_removeReference( model ){
		if( !model ) return;
		if( model.cid ) delete this._byId[ model.cid ];
		var id = model.get ? model.get( model.idAttribute || "id" ) : null;
		if( id != null ) delete this._byId[ id ];
		if( model.collection === this ) delete model.collection;
		if( model.off ) model.off( "all", this._onModelEvent, this );
	}

	// forward a member model's events onto the collection; drop destroyed members
	// and keep the id index fresh when a member's id changes
	_onModelEvent(){
		var args = Array.prototype.slice.call( arguments );
		var event = args[0], model = args[1];
		if( event === "destroy" ) this.remove( model );
		if( model && event === ( "change:" + model.idAttribute ) ){
			var prev = model.previous( model.idAttribute );
			if( prev != null ) delete this._byId[ prev ];
			if( model.id != null ) this._byId[ model.id ] = model;
		}
		this.trigger.apply( this, args );
	}

	/**
	 * Save every model in the collection. Resolves when all have saved.
	 * @param {SyncOptions} [options]
	 * @returns {Promise<Array>}
	 */
	save( options ){
		options = options || {};
		var promises = this.data.map(function( model ){ return model.save( null, options ); });
		return Promise.all( promises );
	}

	// Sync
	// - proxy to the native fetch()-based sync (see sync.js)

	sync( method, model, options ){
		return sync( method, model, options );
	}

	// fetch the collection from the server
	fetch( options ){
		options = options || {};
		var self = this;
		var success = options.success;
		options.success = function( resp ){
			var data = self.parse( resp, options );
			// merge the server response (or replace, with options.reset)
			self[ options.reset ? "reset" : "set" ]( data, options );
			self.options._synced = true;
			if( success ) success.call( options.context, self, resp, options );
			self.trigger("sync", self, resp, options);
		};
		return this.sync("read", this, options);
	}

	/**
	 * Retrieve a single model by array index, id, name, or cid.
	 * @param {(number|string)} key
	 * @returns {?Model}
	 */
	get( key ) {
		if( key == null ) return null;
		// a model instance -> resolve it through the index
		if( key.cid ) return this._byId[ key.cid ] || null;
		// id or cid -> O(1) via the index. This MUST be tried before the integer
		// branch below: ids are numeric far more often than not, and the old
		// order made `get(9)` return the model at index 9 rather than id 9 - so
		// the index was unreachable for the common `{ id: 1 }` convention.
		if( this._byId[ key ] != null ) return this._byId[ key ];
		// integer -> array index (legacy fallback; `at()` is the explicit form).
		// Normalised to null when out of range, so get() honours its ?Model
		// contract instead of mixing null and undefined.
		if( Number.isInteger( key ) ) return this.data[ key ] || null;
		// name -> linear scan
		for ( var i = 0; i < this.data.length; i++ ){
			if( key === this.data[i].get('name') ) return this.data[i];
		}
		return null;
	}

	// the model at a specific index
	at( index ){
		return this.data[ index ];
	}

	// Array methods
	// --------------
	// Proxy the modern native Array.prototype methods to the internal `data`
	// array. Replaces the old Underscore.js iteration mixins - the V8 engine
	// is heavily optimised for these native methods. Legacy Underscore aliases
	// (each/collect/all/any/contains) are kept so existing app code won't break.

	forEach( callback, thisArg ){ return this.data.forEach( callback, thisArg ); }
	each( callback, thisArg ){ return this.forEach( callback, thisArg ); }

	map( callback, thisArg ){ return this.data.map( callback, thisArg ); }
	collect( callback, thisArg ){ return this.map( callback, thisArg ); }

	reduce( callback, initial ){
		return ( arguments.length > 1 ) ? this.data.reduce( callback, initial ) : this.data.reduce( callback );
	}
	reduceRight( callback, initial ){
		return ( arguments.length > 1 ) ? this.data.reduceRight( callback, initial ) : this.data.reduceRight( callback );
	}

	find( callback, thisArg ){ return this.data.find( callback, thisArg ); }
	findIndex( callback, thisArg ){ return this.data.findIndex( callback, thisArg ); }
	filter( callback, thisArg ){ return this.data.filter( callback, thisArg ); }
	reject( callback, thisArg ){ return this.data.filter( function( model, i, arr ){ return !callback.call( thisArg, model, i, arr ); }); }

	every( callback, thisArg ){ return this.data.every( callback, thisArg ); }
	all( callback, thisArg ){ return this.every( callback, thisArg ); }

	some( callback, thisArg ){ return this.data.some( callback, thisArg ); }
	any( callback, thisArg ){ return this.some( callback, thisArg ); }

	includes( model, fromIndex ){ return this.data.includes( model, fromIndex ); }
	contains( model, fromIndex ){ return this.includes( model, fromIndex ); }

	indexOf( model, fromIndex ){ return this.data.indexOf( model, fromIndex ); }
	lastIndexOf( model, fromIndex ){ return this.data.lastIndexOf( model, fromIndex ); }

	slice( start, end ){ return this.data.slice( start, end ); }
	toArray(){ return this.slice(); }

	// Collection specific helpers (native)

	// pluck an attribute from every model in the collection
	pluck( attr ){
		return this.map(function( model ){ return model.get( attr ); });
	}

	// return the models with matching attributes
	where( attrs, first ){
		if( !attrs || Object.keys( attrs ).length === 0 ) return first ? void 0 : [];
		var matcher = function( model ){
			for( var key in attrs ){
				if( attrs[key] !== model.get( key ) ) return false;
			}
			return true;
		};
		return first ? this.find( matcher ) : this.filter( matcher );
	}

	// return the first model with matching attributes
	findWhere( attrs ){
		return this.where( attrs, true );
	}

	isEmpty(){
		return this.length === 0;
	}

	// Underscore-style aggregation helpers (native over this.data)
	// ------------------------------------------------------------
	// The grouping/aggregating helpers Backbone inherited from Underscore, kept
	// as thin native implementations. An "iteratee" is either an attribute-name
	// string (resolved via model.get) or a function called with the model.

	// normalise an iteratee to a function(model) -> value
	_iteratee( iter ){
		if( iter == null ) return function( model ){ return model; };
		if( typeof iter === "string" ) return function( model ){ return model.get( iter ); };
		return iter;
	}

	// shared bucketing engine: apply `behavior(result, key, model)` per model
	_group( iter, behavior ){
		var fn = this._iteratee( iter ), result = {};
		this.forEach(function( model ){
			behavior( result, fn.call( this, model ), model );
		}, this );
		return result;
	}

	// group the models into arrays keyed by the iteratee result
	groupBy( iter ){
		return this._group( iter, function( result, key, model ){
			( result[ key ] || ( result[ key ] = [] ) ).push( model );
		});
	}

	// count the models keyed by the iteratee result
	countBy( iter ){
		return this._group( iter, function( result, key ){
			result[ key ] = ( result[ key ] || 0 ) + 1;
		});
	}

	// a stably-sorted *copy* of the models, ascending by the iteratee result.
	// Non-destructive — unlike sort(), which reorders this.data in place.
	sortBy( iter ){
		var fn = this._iteratee( iter ), self = this;
		return this.slice()
			.map(function( model, index ){ return { model: model, key: fn.call( self, model ), index: index }; })
			.sort(function( a, b ){
				if( a.key !== b.key ) return ( a.key < b.key ) ? -1 : 1;
				return a.index - b.index;   // keep equal keys in original order
			})
			.map(function( entry ){ return entry.model; });
	}

	// call a named method on every model, returning the array of results
	invoke( method ){
		var args = Array.prototype.slice.call( arguments, 1 );
		return this.map(function( model ){
			var fn = ( model == null ) ? null : model[ method ];
			return fn ? fn.apply( model, args ) : undefined;
		});
	}

	// split the models into [ pass, fail ] by a predicate(model)
	partition( predicate ){
		var pass = [], fail = [];
		this.forEach(function( model ){ ( predicate( model ) ? pass : fail ).push( model ); });
		return [ pass, fail ];
	}

	// the model with the smallest iteratee result (undefined when empty)
	min( iter ){
		var fn = this._iteratee( iter ), result, best = Infinity;
		this.forEach(function( model ){
			var value = fn.call( this, model );
			if( value < best ){ best = value; result = model; }
		}, this );
		return result;
	}

	// the model with the largest iteratee result (undefined when empty)
	max( iter ){
		var fn = this._iteratee( iter ), result, best = -Infinity;
		this.forEach(function( model ){
			var value = fn.call( this, model );
			if( value > best ){ best = value; result = model; }
		}, this );
		return result;
	}

	// a random model, or an array of `n` distinct random models (Fisher–Yates)
	sample( n ){
		if( n == null ) return this.data[ Math.floor( Math.random() * this.length ) ];
		var copy = this.slice(), count = Math.max( 0, Math.min( n, copy.length ) );
		for( var i = 0; i < count; i++ ){
			var rand = i + Math.floor( Math.random() * ( copy.length - i ) );
			var tmp = copy[i]; copy[i] = copy[ rand ]; copy[ rand ] = tmp;
		}
		return copy.slice( 0, count );
	}

	// getters (native paradigm favours these over size()/length())
	get length(){
		return this.data.length;
	}

	// alias mirroring the classic Backbone `models` array
	get models(){
		return this.data;
	}

	get size(){
		return this.length;
	}

	// Cache
	// stores/retrieves the collection as a list of model ids in localStorage,
	// resolving each id back to its individually-cached model on read.
	cache( data ){
		// no usable storage engine (SSR, private mode, blocked site data)
		if( !store.available() ) return false;
		var opts = ( this.options && this.options.cacheOptions ) || {};
		var name = opts.cache_key || this.name || this.cid;
		// SET: store just the ids of the models
		if( data ){
			var ids = data.map(function( item ){ return item.id || item._id; });
			return store.set( name, JSON.stringify( ids ) );
		}
		// GET: resolve each cached id back to its cached model data
		var stored = store.get( name );
		if( !stored ) return false;
		var list = JSON.parse( stored );
		// determine the model cache-name convention
		var ModelClass = this.model;
		var sample = new ModelClass();
		var mopts = ( sample.options && sample.options.cacheOptions ) || {};
		var mname = mopts.cache_key || sample.name || "model";
		return list.map(function( id ){
			var mdata = store.get( mname + "_" + id );
			return mdata ? JSON.parse( mdata ) : {};
		});
	}

	parse( data ){
		var self = this;
		setTimeout(function(){ self.trigger("fetch"); }, 200); // better way to trigger this after parse?
		// cache results
		if( this.options.cache ){
			this.cache( data );
		}
		return data;
	}

	// serialise the collection to a plain array of the models' data
	toJSON( options ){
		return this.data.map(function( model ){
			return ( model && typeof model.toJSON === "function" ) ? model.toJSON( options ) : model;
		});
	}

	// extract data (and possibly filter keys)
	output(){
		// in most cases it's a straight JSON output
		return this.toJSON();
	}

	isNew() {
		return this.options._synced === false;
	}

	// - check if the app is online
	// see Model#isOnline: only `typeof` is safe on the (possibly undeclared)
	// `app` global that the APP facade publishes
	isOnline(){
		return ( typeof app !== "undefined" && app && app.state ) ? app.state.online : true;
	}

}


class Layout extends View {

	constructor( options ) {
		// fallback(s)
		options = options || {};
		// the layout binds to <body> by default
		options.el = options.el || "body";
		// merge the layout defaults under any caller options
		options = _.extend({
			autosync : false,
			autorender: true,
			sync_events: "add remove change"
		}, options);
		// inherit View (resolves this.el, this.state, runs initialize())
		super( options );

		// layout identity + a truly-delegated link handler on the root element
		this.cid = _.uniqueId("layout");
		var self = this;
		this._onClick = function( e ){ self._clickLink( e ); };
		this.el.addEventListener("click", this._onClick);
	}

	initialize(){
		// container for registered child views (a plain map, not a Model:
		// views hold DOM nodes / circular refs that don't belong in attributes)
		this.views = {};

		// re-render the layout when an "update" is triggered
		this.on("update", this.update, this);

		// #77 using the url option to compile a shell template
		if( this.options.url || this.url ){
			var url = this.options.url || this.url;
			// set the type to default (as the Template expects)
			if( !this.options.type ) this.options.type = "default";
			this.template = new Template(null, { url : url });
			if( this.options.autorender ) this.template.on("loaded", this.render, this);
		}
		// (this.data is already resolved by the View constructor)
	}

	preRender(){

	}

	render(){
		this._preRender();
		// remove loading class (if any)
		this.el.classList.remove("loading");

		// creating html if required
		if( this.template ){
			var template = ( this.options.type ) ? this.template.get( this.options.type ) : this.template;
			// use the options as data..
			var html = ( template instanceof Function ) ? template( this.options ) : template;
			this.el.innerHTML = html;
		}

		this._postRender();
	}

	postRender(){
	}

	update( e ){
		e = e || false;
		// if there's no event exit?
		if( !e ) return;
		// broadcast the event to the views...
		// - if there's rerouting:
		if( e.navigate ){
			for( var i in this.views ){
				if( typeof this.views[i]._navigate === "function" ) this.views[i]._navigate(e);
			}
		}
		// - include other conditions...
	}

	// setter and getter mirroring the Model methods
	set( views ){
		// add event triggers on the views
		for( var i in views ){
			// tracked via listenTo so remove() tears the bindings down
			this.listenTo( views[i], "loaded", this._viewLoaded );
			// 'stamp' each view with a label
			views[i]._name = i;
			// bind events
			if( views[i].data ) {
				// view reference in the data
				views[i].data._view = i;
				// bind all data updates to the layout
				this.listenTo( views[i].data, this.options.sync_events, this._syncData );
			}
			// register the view
			this.views[i] = views[i];
		}
		return this.views;
	}

	get( view ){
		return this.views[ view ];
	}

	// removes a view
	remove( name ){
		var view = this.get( name );
		// prerequisite
		if( _.isUndefined(view) ) return;
		// drop our listeners on this view + its data
		this.stopListening( view );
		if( view.data ) this.stopListening( view.data );
		// undelegate view events
		view.remove();
		// remove the reference from this.views
		delete this.views[ name ];
	}

	findLink( target ) {
		var link = (target.tagName != "A") ? target.closest("a") : target;
		if( !link ) return false;
		var url = link.getAttribute("href");
		// filter some URLs
		// - defining local URLs
		var isLocal = (url) ? ( url.substr(0,1) == "#" || (url.substr(0,2) == "/#" && window.location.pathname == "/" ) ) : false;
		return ( _.isEmpty(url) || isLocal || link.getAttribute("target") ) ? false : url;
	}

	// Internal methods
	_preRender(){
		// add touch class to body (when the app global exposes it)
		if( typeof app !== "undefined" && app.state && app.state.touch ) this.el.classList.add("touch");
		// app-specific actions
		this.preRender();
	}

	_postRender(){
		// app-specific actions
		this.postRender();
	}

	_viewLoaded(){
		var registered = 0,
			loaded = 0;
		// check if all the views are loaded
		_.each(this.views, function( view ){
			if( view.state && view.state.get && view.state.get("loaded") ) loaded++;
			registered++;
		});

		// when all views are loaded...
		if( registered && registered == loaded ){
			this._allViewsLoaded();
		}

	}

	// what to do after all views are loaded (once)
	_allViewsLoaded(){
		if( this._loaded ) return;
		this._loaded = true;
		// re-render the layout
		this.render();
	}

	// broadcast all data updates in the views back to the layout
	_syncData( model, collection, options ){
		var value;
		// fallback
		var data = collection || model || false;
		if( !data ) return;
		// get the key of the data
		var key = data._view || false;
		// if we haven't kept a reference key to backtrack, exit now
		if( !key ) return;
		// this automation only works when the layout data is a Model
		if( this.model instanceof Model ){
			var keys = Object.keys( this.model.attributes ) || [];
			// this only works if there's existing data
			if( keys.indexOf( key ) == -1 ) return;
			// get the data in an exported form (usually toJSON is enough)
			try{
				value = data.output();
			} catch( e ){
				// assume this collection is generic
				value = data.toJSON();
			}
			// final condition...
			if( value ){
				var attr = {};
				attr[key] = value;
				this.model.set( attr );
				// immediately save?
				if (this.options.autosync){
					this.model.save();
				}
			}
		}
	}

	_clickLink( e ){
		var link = e.target.closest("a");
		// let external / alternate links pass through untouched
		if( link ){
			var rel = link.getAttribute("rel");
			if( rel === "external" || rel === "alternate" ) return;
		}
		var url = this.findLink(e.target);
		if( url ){
			// add loading class
			this.el.classList.add("loading");
		}
		// when to intercept links (standalone / app mode)
		if( url && typeof app !== "undefined" && app.state && typeof app.state.standalone === "function" && app.state.standalone() ){
			// block default behavior
			e.preventDefault();
			//
			window.location = url;
			return false;
		}
		// otherwise pass through...
	}

}

/*
 * Session
 * Based on Backbone.Session: https://github.com/makesites/backbone-session
 * Copyright © Makesites.org
 */


 class Session extends Model {

	constructor( model, options ){
		// fallback(s)
		options = options || {};
		// session-specific defaults, merged over any passed options
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
		// inherit the Model (this also runs initialize())
		super( model, opts );
	}

	initialize(){

		// initial session state
		this.state = false;
		// bind context so these also work when passed as detached callbacks
		// (Base.on already applies the right context, so this is belt-and-braces)
		this.update = this.update.bind(this);
		this.cache = this.cache.bind(this);
		this.logout = this.logout.bind(this);
		this.error = this.error.bind(this);
		// replace the whole URL if supplied
		if( this.options.url ) this.url = this.options.url;

		// pick a persistance solution. These are capability checks, not `typeof`
		// checks: Node >= 22 defines localStorage/sessionStorage globals that may
		// have no working methods, and a browser with site data blocked exposes
		// the object but throws on access (see the note in cache.js).
		if( !this.options.persist && sessionStore.available() ){
			this.store = sessionStore;
		} else if( this.options.persist && localStore.available() ){
			this.store = localStore;
		} else if( cookieStore.available() ){
			// otherwise we need to store data in a cookie
			this.store = cookieStore;
		} else {
			// no browser storage at all (SSR): keep the session in memory so the
			// model still works for the life of the process
			this.store = memoryStore;
		}

		// try loading the session
		var localSession = this.store.get("session");
		//
		if( _.isNull(localSession) || !this.options.local ){
			// - no valid local session, try the server
			this.fetch();
		} else {
			this.set( JSON.parse( localSession ) );
			// reset the updated flag
			this.set({ updated : 0 });
			// fetch if not authenticated (every time)
			if( !this.get('auth') && this.options.remote ) this.fetch();
			// sync with the server ( if broadcasting local info )
			if( this.options.broadcast ) this.save();
		}

		// event binders
		this.bind("change",this.update);
		this.bind("error", this.error);
		this.on("logout", this.logout);
	}


	url(){ return this.options.host + "/session"; }

	parse( data ) {
		// if there is no response, keep what we've got locally
		if( _.isNull(data) ) return;
		// add updated flag
		if( typeof data.updated == "undefined" ){
			data.updated = Date.now();
		}
		// add an id if one is not supplied
		if( !data.id) data.id = this.generateUid();
		return data;
	}

	sync(method, model, options) {
		// fallbacks
		options = options || {};
		// exit if explicitly noted as not calling a remote
		if( !this.options.remote || (!this.options.broadcast && method != "read") ){
			this.update();
			// keep the Promise contract of the native sync layer
			return Promise.resolve();
		}
		// delegate to the native fetch()-based Model.sync
		return super.sync(method, model, options);
	}

	update(){
		// set a trigger
		if( !this.state ) {
			this.state = true;
			this.trigger("loaded");
		}
		// caching is triggered after every model update (fetch/set)
		if( this.get("updated") || !this.options.remote ){
			this.cache();
		}
	}

	cache(){
		// update the local session
		this.store.set("session", JSON.stringify( this.toJSON() ) );
		// check if the object has changed locally
		//...
	}

	// Destroy session - Source: http://backbonetutorials.com/cross-domain-sessions/
	logout( options ){
		// Do a DELETE to /session and clear the clientside data
		var self = this;
		options = options || {};
		// delete local version
		this.store.clear("session");
		// notify remote
		this.destroy({
			wait: true,
			success: function (model, resp) {
				model.clear();
				model.id = null;
				// Set auth to false to trigger a change:auth event
				// The server also returns a new csrf token so that
				// the user can relogin without refreshing the page
				self.set({auth: false});
				if( resp && resp._csrf) self.set({_csrf: resp._csrf});
				// reload the page if needed
				if( options.reload ){
					window.location.reload();
				}
			}
		});
	}

	// if data request fails request offline mode.
	error( model, req, options, error ){
		// consider redirecting based on statusCode
		console.log( req );
	}

	// Helpers
	// - Creates a unique id for identification purposes
	generateUid( separator ){

		var delim = separator || "-";

		function S4() {
			return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
		}

		return (S4() + S4() + delim + S4() + delim + S4() + delim + S4() + delim + S4() + S4() + S4());
	}
}


// Stores
// Each exposes the same tiny contract: available() / get() / set() / check() /
// clear(). `available()` is a capability probe rather than a `typeof` check -
// see the note in cache.js - and the accessors never throw, so a locked-down
// browser degrades instead of breaking the session.
// `check( name )` uniformly answers "is this slot EMPTY?" (cookieStore used to
// answer the opposite, which made the three implementations disagree).

let sessionStore = {
	available : function(){
		try {
			return typeof sessionStorage !== "undefined" && sessionStorage !== null
				&& typeof sessionStorage.getItem === "function"
				&& typeof sessionStorage.setItem === "function";
		} catch( e ){ return false; }
	},
	get : function( name ) {
		try { return sessionStorage.getItem( name ); } catch( e ){ return null; }
	},
	set : function( name, val ){
		try { return sessionStorage.setItem( name, val ); } catch( e ){ return false; }
	},
	check : function( name ){
		return sessionStore.get( name ) == null;
	},
	clear: function( name ){
		// actually just removing the session...
		try { return sessionStorage.removeItem( name ); } catch( e ){ return false; }
	}
};

let localStore = {
	available : function(){
		try {
			return typeof localStorage !== "undefined" && localStorage !== null
				&& typeof localStorage.getItem === "function"
				&& typeof localStorage.setItem === "function";
		} catch( e ){ return false; }
	},
	get : function( name ) {
		try { return localStorage.getItem( name ); } catch( e ){ return null; }
	},
	set : function( name, val ){
		try { return localStorage.setItem( name, val ); } catch( e ){ return false; }
	},
	check : function( name ){
		return localStore.get( name ) == null;
	},
	clear: function( name ){
		// actually just removing the session...
		try { return localStorage.removeItem( name ); } catch( e ){ return false; }
	}
};

let cookieStore = {
	available : function(){
		try { return typeof document !== "undefined" && typeof document.cookie === "string"; }
		catch( e ){ return false; }
	},

	get : function( name ) {
		var i,key,value,cookies=document.cookie.split(";");
		for (i=0;i<cookies.length;i++){
			key=cookies[i].substr(0,cookies[i].indexOf("="));
			value=cookies[i].substr(cookies[i].indexOf("=")+1);
			key=key.replace(/^\s+|\s+$/g,"");
			if (key==name){
				return decodeURIComponent(value);
			}
		}
		return null;
	},

	set : function( name, val ){
		// automatically expire session in a day
		var expiry = 86400000;
		var date = new Date( Date.now() + parseInt(expiry) );
		var value = encodeURIComponent(val) + "; expires=" + date.toUTCString();
		document.cookie = name + "=" + value;
	},

	check : function( name ){
		return cookieStore.get( name ) == null;
	},

	clear: function( name ) {
		document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
	}
};

// last-resort, in-process store so a Session constructed without any browser
// storage (SSR, a worker without cookies) still behaves instead of throwing
let memoryStore = {
	_data : Object.create( null ),
	available : function(){ return true; },
	get : function( name ){ return ( name in memoryStore._data ) ? memoryStore._data[name] : null; },
	set : function( name, val ){ memoryStore._data[name] = String( val ); return true; },
	check : function( name ){ return memoryStore.get( name ) == null; },
	clear : function( name ){ delete memoryStore._data[name]; return true; }
};


// Reserved words that cannot be used as a function parameter name, so they can
// never be exposed as a template variable (the payload is still reachable as
// `data` / `obj`).
const RESERVED_WORDS = new Set([
	"break","case","catch","class","const","continue","debugger","default","delete",
	"do","else","enum","export","extends","false","finally","for","function","if",
	"import","in","instanceof","new","null","return","super","switch","this","throw",
	"true","try","typeof","var","void","while","with","yield","let","static",
	"implements","interface","package","private","protected","public","await","arguments","eval"
]);

class Template extends Model {

	constructor( html, options ) {
		// fallback(s)
		options = options || {};
		html = html || "";
		// pass options as Model *options* (not as model attributes) so this.options
		// carries url/type/compiler. (Was `super(options)`, which mis-routed them
		// into attributes and left this.options.url undefined - the remote-template
		// url branch never fired.)
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
	_setupTemplate(){
		var html = this.html;

		if( !_.isEmpty(html) ){
			this.set( "default", this.compile( html ) );
			this.trigger("loaded");
		}
		if( this.options.url ){
			this.url = this.options.url;
			this.fetch();
		}
	}

	compile( markup ){

		// Pluggable compiler: when a `compiler` option is supplied (e.g.
		// Handlebars.compile, or a CSP-safe engine), delegate to it instead of the
		// built-in one. The built-in uses `new Function`, which requires the
		// 'unsafe-eval' CSP directive - inject a compiler to run under strict CSP.
		var compiler = this.options && this.options.compiler;
		if( typeof compiler === "function" ) return compiler( markup );

		// coerce to a string template (the markup itself is author-trusted)
		var cleanMarkup = _.isString( markup ) ? markup : String( markup == null ? "" : markup );
		// escape backticks so they don't terminate the template literal early
		cleanMarkup = cleanMarkup.replace(/`/g, '\\`');
		// escaper applied to interpolated *values* (mitigates HTML/script injection)
		var escape = this._sanitize();
		// compiled functions, keyed by the argument signature. The signature only
		// changes when the shape of the data changes, so in practice a template is
		// compiled once instead of on every single render.
		var compiled = Object.create( null );
		// main function
		var template = function( data ){
			data = data || {};
			// The whole payload is always available as `data` / `obj`, and `escape`
			// is the HTML escaper (top-level string values are escaped for you;
			// anything you reach through `data` is raw, so escape it yourself:
			// `${data.items.map(i => escape(i.title))}`).
			//
			// Only keys that are legal JavaScript identifiers can also be exposed
			// by name: `new Function(...)` builds a parameter list, so a key like
			// "0" (every key of an array - e.g. a Collection's toJSON()) or
			// "foo-bar" used to throw `SyntaxError: Unexpected number` at render
			// time, taking every collection-backed view down with it.
			const keys = [ "data", "obj", "escape" ];
			const values = [ data, data, escape ];
			Object.keys( data ).forEach(function( key ){
				if( !Template.isIdentifier( key ) || keys.indexOf( key ) > -1 ) return;
				keys.push( key );
				var value = data[key];
				// HTML-escape string values before they are interpolated
				values.push( ( typeof value === "string" ) ? escape( value ) : value );
			});

			const signature = keys.join(",");
			const fn = compiled[signature] ||
				( compiled[signature] = new Function(...keys, 'return `' + cleanMarkup + '`') );

			return fn(...values);
		};

		//template.bind( this );

		return template;
	}

	// Is `name` usable as a function parameter? (a valid identifier, and not a
	// reserved word - `new Function("class", ...)` is a SyntaxError)
	static isIdentifier( name ){
		return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test( name ) && !RESERVED_WORDS.has( name );
	}

	// fetch a remote template file natively (no jQuery $.get)
	async fetch(){
		try {
			const response = await fetch( this.url );
			const html = await response.text();
			this.parse( html );
		} catch( err ){
			console.error("Failed to load template:", this.url, err);
		}
	}

	parse( data ){
		var self = this;
		// natively parse the fetched HTML string into a queryable document
		var doc;
		try {
			doc = new DOMParser().parseFromString( data, "text/html" );
		} catch( e ){
			// can't parse this - probably not html...
			doc = null;
		}
		// look for template fragments: modern <template> or <script type="...template...">
		var fragments = doc ? doc.querySelectorAll('template, script[type*="template"]') : [];
		// check if there are any template fragments
		if( !fragments.length ){
			// save everything in the default attr
			this.set( "default", self.compile( data ) );
		} else {
			// loop through the fragments
			fragments.forEach(function( el ){
				// convention: the id sets the key for the template
				if( el.id ) self.set( el.id, self.compile( el.innerHTML ) );
			});
		}
		this.trigger("loaded");
		//return data;
	}

	// internal methods
	// returns a function that HTML-escapes a value; applied to interpolated data
	// (not to the markup itself) to prevent injection when set via innerHTML
	_sanitize() {
		const replaceTags = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;'
		};

		return function( text ){
			return String( text ).replace(/[&<>"']/g, tag => replaceTags[tag] || tag);
		};
	}

}

/*
 * cache
 * localStorage-backed offline cache for Models & Collections
 * Based on backbone-cache: https://github.com/makesites/backbone-cache
 * Copyright © Makesites.org
 */

// Storage helper - a module-scoped singleton so it isn't duplicated across
// every instance (as it was when attached to the prototype in the legacy plugin).
//
// `available()` is a capability check, not a `typeof` check. A bare
// `typeof localStorage === "undefined"` guard is not enough any more:
// - Node >= 22 defines a `localStorage` global that is an empty object unless
//   the runtime was started with a valid `--localstorage-file`, so the methods
//   are missing and every cache call threw `localStorage.getItem is not a
//   function` under SSR / tests;
// - browsers in private mode, or with site data blocked, expose the object but
//   throw on access.
var store = {
	available : function(){
		try {
			return typeof localStorage !== "undefined"
				&& localStorage !== null
				&& typeof localStorage.getItem === "function"
				&& typeof localStorage.setItem === "function";
		} catch( e ){
			// accessing the global itself can throw when site data is blocked
			return false;
		}
	},
	get   : function( name ){ try { return localStorage.getItem( name ); } catch( e ){ return null; } },
	set   : function( name, val ){ try { return localStorage.setItem( name, val ); } catch( e ){ return false; } },
	check : function( name ){ return store.get( name ) === null; },
	clear : function( name ){ try { return localStorage.removeItem( name ); } catch( e ){ return false; } }
};

/*
 * sync
 * Native fetch() replacement for Backbone.sync / jQuery $.ajax
 * Copyright © Makesites.org
 */

// map the CRUD methods to HTTP verbs
var methodMap = {
	"create" : "POST",
	"update" : "PUT",
	"patch"  : "PATCH",
	"delete" : "DELETE",
	"read"   : "GET"
};

// App-wide sync configuration (native replacement for the jQuery ajaxPrefilter).
// Configure via configureSync() - e.g. the Controller sets the API base URL,
// credentials and a CSRF header getter here.
var syncConfig = {
	base: "",           // prepended to relative (non-absolute) request URLs
	credentials: null,  // e.g. "include" to send cookies cross-origin
	headers: null       // an object, or a function returning per-request headers
};

function configureSync( config ){
	return _.extend( syncConfig, config || {} );
}

/**
 * @typedef {Object} SyncOptions
 * @property {string} [url] - overrides the model/collection url
 * @property {Object} [headers] - extra request headers
 * @property {*} [data] - raw request body (bypasses JSON serialisation)
 * @property {Object} [attrs] - attributes to send (defaults to model.toJSON())
 * @property {Object} [fetchOptions] - passed through to fetch() (credentials, signal, ...)
 * @property {number} [timeout] - ms after which the request auto-aborts
 * @property {AbortSignal} [signal] - wire the request to your own controller
 * @property {number} [retry] - retry count for transient read failures (default 0)
 * @property {number} [retryDelay] - base backoff in ms (default 300)
 * @property {function(*, string, Response=):void} [success]
 * @property {function(Error, string, Response=):void} [error]
 */

/**
 * Perform a single native fetch() request: assemble → fetch → parse → check →
 * cache-on-success → success callback. Throws the raw error on failure; the
 * retry / cache-fallback / error-event handling lives in sync() so it happens
 * once per call rather than once per network attempt.
 * @param {("create"|"read"|"update"|"patch"|"delete")} method
 * @param {Base} model
 * @param {SyncOptions} options
 * @returns {Promise<*>}
 */
async function _syncRequest( method, model, options ){
	var type = methodMap[ method ];

	// assemble the request
	var params = {
		method: type,
		headers: {
			"Accept": "application/json, text/javascript, */*; q=0.01"
		}
	};
	// apply the app-wide credentials + headers (from configureSync)
	if( syncConfig.credentials ) params.credentials = syncConfig.credentials;
	if( syncConfig.headers ){
		var extra = ( typeof syncConfig.headers === "function" ) ? syncConfig.headers() : syncConfig.headers;
		if( extra ) params.headers = _.extend( params.headers, extra );
	}
	// allow custom fetch options (credentials, mode, signal, etc.)
	if( options.fetchOptions ) params = _.extend( params, options.fetchOptions );
	// merge any custom headers (assign the result: _.extend mutates & returns it)
	if( options.headers ) params.headers = _.extend( params.headers || {}, options.headers );

	// ensure that we have a URL
	var url = options.url || _.result( model, "url" );
	if( !url ) throw new Error('A "url" property or function must be specified');
	// prepend the configured API base for relative URLs
	if( syncConfig.base && !/^https?:\/\//.test( url ) ) url = syncConfig.base + url;

	// ensure the request has the appropriate body for write operations
	if( options.data == null && model && (method === "create" || method === "update" || method === "patch") ){
		params.headers["Content-Type"] = "application/json";
		params.body = JSON.stringify( options.attrs || model.toJSON( options ) );
	} else if( options.data != null ){
		// raw body (URLSearchParams, FormData, string...)
		params.body = options.data;
	}

	// cancellation / timeout via AbortController. Pass options.signal to wire the
	// request to your own controller, or options.timeout (ms) to auto-abort. The
	// created controller is exposed as options.controller so you can abort early.
	// A fresh controller/timer is created per attempt so every retry gets a full
	// timeout budget.
	var timer;
	if( typeof AbortController !== "undefined" ){
		if( options.signal ){
			params.signal = options.signal;
		} else if( options.timeout ){
			var controller = new AbortController();
			params.signal = controller.signal;
			options.controller = controller;
			timer = setTimeout(function(){ controller.abort(); }, options.timeout );
		}
	}

	try {
		// execute the native request
		var response = await fetch( url, params );

		// parse the response based on its Content-Type
		var responseData;
		var contentType = response.headers.get("content-type");
		if( contentType && contentType.includes("application/json") ){
			responseData = await response.json();
		} else {
			// fallback for empty responses (204) or plain text
			var text = await response.text();
			responseData = text ? text : null;
		}

		// native fetch() does not reject on 4xx/5xx, so we check manually
		if( !response.ok ){
			var error = new Error( response.statusText || ("HTTP Error " + response.status) );
			error.status = response.status;
			error.response = response;
			error.responseData = responseData;
			throw error;
		}

		// CACHE: update the local cache with the fresh server data (opt-in via
		// the model's `cache` option). Keeps localStorage in sync on every
		// successful read/write.
		if( model.options && model.options.cache && typeof model.cache === "function" &&
			(method === "read" || method === "create" || method === "update" || method === "patch") ){
			model.cache( responseData );
		}

		// fire the success callback (models/collections wrap this to set data)
		if( options.success ) options.success( responseData, response.statusText, response );

		return responseData;

	} finally {
		// clear the timeout timer regardless of outcome
		if( timer ) clearTimeout( timer );
	}
}

/**
 * Persist a model/collection to the server via the native fetch() API. Returns a
 * Promise and still fires the success/error callbacks + request/error events.
 *
 * Opt-in retry: pass `options.retry` (a count) to retry *transient* failures
 * with exponential backoff + jitter. Retries are gated to safe reads and genuine
 * network errors — an HTTP status (4xx/5xx) or an abort (timeout / caller cancel)
 * is never retried. Tune the base delay with `options.retryDelay` (ms, default
 * 300). The default `retry: 0` preserves the original single-attempt behaviour.
 * @param {("create"|"read"|"update"|"patch"|"delete")} method
 * @param {Base} model - a Model or Collection
 * @param {SyncOptions} [options]
 * @returns {Promise<*>}
 */
async function sync( method, model, options ){
	// fallback(s)
	options = options || {};
	var retries = options.retry || 0;
	var base = options.retryDelay || 300;
	var attempt = 0;

	// let listeners know a request is under way (parity with Backbone) — once,
	// regardless of how many network attempts follow
	model.trigger("request", model, null, options);

	while( true ){
		try {
			return await _syncRequest( method, model, options );
		} catch( error ){
			// retry only genuine network failures on safe reads: an HTTP status
			// (4xx/5xx) or an abort is never retried
			var retriable = method === "read"
				&& error.name !== "AbortError"
				&& error.status == null;
			if( retriable && attempt < retries ){
				// exponential backoff with jitter: base·2^n + rand·base
				var delay = base * Math.pow( 2, attempt ) + Math.random() * base;
				attempt++;
				await new Promise(function( resolve ){ setTimeout( resolve, delay ); });
				// honour a cancellation requested between tries
				if( !( options.signal && options.signal.aborted ) ) continue;
			}

			// CACHE: on a failed read, transparently fall back to the local cache
			// so the UI can still render while offline (stale-while-revalidate).
			if( method === "read" && model.options && model.options.cache && typeof model.cache === "function" ){
				var cached = model.cache();
				var hasData = Array.isArray( cached ) ? cached.length > 0 : ( cached && Object.keys( cached ).length > 0 );
				if( hasData ){
					if( options.success ) options.success( cached, "success-from-cache", null );
					return cached;
				}
			}
			// fire the error callback
			if( options.error ) options.error( error, error.statusText, error.response );
			// bubble up a global error event
			model.trigger("error", model, error, options);
			// re-throw so callers awaiting the promise can catch it
			throw error;
		}
	}
}

/*
 * Input Mixins
 * Modern, zero-dependency ES6 mixins for Touch, Mouse, Scroll, Motion,
 * Gamepad and Keys. Compose them over any class that exposes `this.el`,
 * `this.options` and `this.trigger()` (e.g. View):
 *
 *   class CarouselView extends TouchMixin( View ) { ... }
 *   class GameView extends KeysMixin( GamepadMixin( View ) ) { ... }
 *
 * Based on the backbone.input.* plugins.
 * Copyright © Makesites.org
 */

// -----------------------------------------------------------------------------
// 1. Touch
// -----------------------------------------------------------------------------
const TouchMixin = ( BaseClass ) => class extends BaseClass {
	constructor( options = {} ){
		super( options );
		this.touchState = { touching: false, swiping: false, direction: false };
		this.touchParams = { start: null, previous: null, current: null };

		this.touchOptions = Object.assign({
			threshold: 10,
			inertia: 0,
			blocking: true,
			monitor: true
		}, options.touch || {});

		if( this.isTouch && this.touchOptions.monitor ){
			this._bindTouchEvents();
		}
	}

	get isTouch(){
		return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
	}

	_bindTouchEvents(){
		const opts = this.touchOptions.blocking ? { passive: false } : { passive: true };
		this.el.addEventListener('touchstart', this._touchstart.bind(this), opts);
		this.el.addEventListener('touchmove', this._touchmove.bind(this), opts);
		this.el.addEventListener('touchend', this._touchend.bind(this), opts);
	}

	_touchstart( e ){
		const touch = e.touches[0];
		const coords = { x: touch.clientX, y: touch.clientY };
		this.touchState.touching = true;
		this.touchParams.start = coords;
		this.touchParams.previous = coords;
		this.touchParams.current = coords;
		this.trigger('touchstart', e);
	}

	_touchmove( e ){
		if( !this.touchState.touching ) return;
		const touch = e.touches[0];
		const current = { x: touch.clientX, y: touch.clientY };
		const previous = this.touchParams.previous;

		const direction = this._calculateDirection(current, previous);
		this.touchState.swiping = !!direction;
		this.touchState.direction = direction;

		if( direction && this.touchOptions.blocking && e.cancelable ) e.preventDefault();

		this.touchParams.previous = this.touchParams.current;
		this.touchParams.current = current;
		this.trigger('touchmove', e);
	}

	_touchend( e ){
		if( e.touches.length === 0 ){
			this.touchState.touching = false;
			this.touchState.swiping = false;
			this.touchParams.start = null;
		}
		this.trigger('touchend', e);
	}

	_calculateDirection( current, previous ){
		const dx = current.x - previous.x;
		const dy = current.y - previous.y;
		const { inertia, threshold } = this.touchOptions;

		if( dx > inertia && Math.abs(dy) < threshold ) return "right";
		if( dx < -inertia && Math.abs(dy) < threshold ) return "left";
		if( dy > inertia && Math.abs(dx) < threshold ) return "bottom";
		if( dy < -inertia && Math.abs(dx) < threshold ) return "top";
		return false;
	}

	getSwipeDistance( axis = 'x' ){
		if( !this.touchParams.start || !this.touchParams.current ) return 0;
		return this.touchParams.current[axis] - this.touchParams.start[axis];
	}
};

// -----------------------------------------------------------------------------
// 2. Mouse
// -----------------------------------------------------------------------------
const MouseMixin = ( BaseClass ) => class extends BaseClass {
	constructor( options = {} ){
		super( options );
		this.mouseState = { hover: false, drag: false, pressing: false };
		this.mousePos = { x: 0, y: 0 };
		if( options.monitorMouse ) this.monitorMouse();
	}

	monitorMouse(){
		this.el.addEventListener('mousemove', this._onMouseMove.bind(this), { passive: true });
		this.el.addEventListener('mousedown', () => { this.mouseState.pressing = true; }, { passive: true });
		this.el.addEventListener('mouseup', () => { this.mouseState.pressing = false; }, { passive: true });
	}

	_onMouseMove( e ){
		if( this._mouseTicking ) return;
		this._mouseTicking = true;
		requestAnimationFrame(() => {
			this.mousePos.x = e.clientX;
			this.mousePos.y = e.clientY;
			this.trigger('mousemove', this.mousePos);
			this._mouseTicking = false;
		});
	}
};

// -----------------------------------------------------------------------------
// 3. Scroll
// -----------------------------------------------------------------------------
const ScrollMixin = ( BaseClass ) => class extends BaseClass {
	constructor( options = {} ){
		super( options );
		this.scrollState = { top: 0, height: 0, max: 0 };
		if( options.monitorScroll ) this.monitorScroll();
	}

	monitorScroll(){
		window.addEventListener('scroll', this._onScroll.bind(this), { passive: true });
	}

	_onScroll(){
		if( this._scrollTicking ) return;
		this._scrollTicking = true;
		requestAnimationFrame(() => {
			this.scrollState.top = window.scrollY;
			this.scrollState.height = document.documentElement.scrollHeight;
			this.scrollState.max = this.scrollState.height - window.innerHeight;
			this.trigger('scroll', this.scrollState);
			this._scrollTicking = false;
		});
	}
};

// -----------------------------------------------------------------------------
// 4. Motion
// -----------------------------------------------------------------------------
const MotionMixin = ( BaseClass ) => class extends BaseClass {
	constructor( options = {} ){
		super( options );
		this.motionState = { alpha: 0, beta: 0, gamma: 0 };
		if( options.monitorMotion ) this.monitorMotion();
	}

	monitorMotion(){
		if( window.DeviceOrientationEvent ){
			window.addEventListener('deviceorientation', this._onOrientation.bind(this), { passive: true });
		}
	}

	_onOrientation( e ){
		this.motionState = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
		this.trigger('deviceorientation', this.motionState);
	}
};

// -----------------------------------------------------------------------------
// 5. Gamepad
// -----------------------------------------------------------------------------
const BUTTON_MAP = ['button_a','button_b','button_x','button_y','bumper_left','bumper_right','trigger_left','trigger_right','button_select','button_start','stick_left_click','stick_right_click','dpad_up','dpad_down','dpad_left','dpad_right','button_home'];
const AXIS_MAP = ['stick_left_x','stick_left_y','stick_right_x','stick_right_y'];

function applyDeadzone( value, deadzone, maximizeThreshold ){
	if( value >= 0 ){
		if( value < deadzone ) return 0.0;
		if( value > maximizeThreshold ) return 1.0;
	} else {
		if( value > -deadzone ) return 0.0;
		if( value < -maximizeThreshold ) return -1.0;
	}
	return value;
}

const GamepadMixin = ( BaseClass ) => class extends BaseClass {
	constructor( options = {} ){
		super( options );
		this.gamepads = {};
		this._buttonStates = {};
		this._axisStates = {};
		this._pollingLoop = null;

		this.gamepadOptions = Object.assign({ deadzone: 0.05, maximizeThreshold: 0.97 }, options.gamepad || {});
		if( options.monitorGamepad ) this.monitorGamepad();
	}

	monitorGamepad(){
		window.addEventListener('gamepadconnected', ( e ) => {
			this.gamepads[e.gamepad.index] = e.gamepad;
			this.trigger('gamepad-connect', e.gamepad);
			if( !this._pollingLoop ) this._pollGamepads();
		});
		window.addEventListener('gamepaddisconnected', ( e ) => {
			delete this.gamepads[e.gamepad.index];
			this.trigger('gamepad-disconnect', e.gamepad);
			if( Object.keys(this.gamepads).length === 0 ){
				cancelAnimationFrame(this._pollingLoop);
				this._pollingLoop = null;
			}
		});
	}

	_pollGamepads(){
		const hardwarePads = navigator.getGamepads ? navigator.getGamepads() : [];
		for( let pad of hardwarePads ){
			if( pad ){
				this._processGamepadButtons(pad);
				this._processGamepadAxes(pad);
				this.trigger('gamepad-update', pad);
			}
		}
		this._pollingLoop = requestAnimationFrame(this._pollGamepads.bind(this));
	}

	_processGamepadButtons( pad ){
		if( !this._buttonStates[pad.index] ) this._buttonStates[pad.index] = [];
		const prevStates = this._buttonStates[pad.index];

		pad.buttons.forEach(( button, index ) => {
			const buttonName = BUTTON_MAP[index] || `button_${index}`;
			const wasPressed = prevStates[index];
			const isPressed = button.pressed;

			if( isPressed && !wasPressed ){
				this.trigger('gamepad-buttondown', { padIndex: pad.index, button: buttonName, value: button.value });
			} else if( !isPressed && wasPressed ){
				this.trigger('gamepad-buttonup', { padIndex: pad.index, button: buttonName });
			}
			prevStates[index] = isPressed;
		});
	}

	_processGamepadAxes( pad ){
		if( !this._axisStates[pad.index] ) this._axisStates[pad.index] = [];
		const prevStates = this._axisStates[pad.index];
		const { deadzone, maximizeThreshold } = this.gamepadOptions;

		pad.axes.forEach(( rawAxisValue, index ) => {
			const axisName = AXIS_MAP[index] || `axis_${index}`;
			const filteredValue = applyDeadzone(rawAxisValue, deadzone, maximizeThreshold);
			const prevValue = prevStates[index] || 0.0;

			if( filteredValue !== prevValue ){
				this.trigger('gamepad-axis', { padIndex: pad.index, axis: axisName, value: filteredValue });
			}
			prevStates[index] = filteredValue;
		});
	}
};

// -----------------------------------------------------------------------------
// 6. Keys
// -----------------------------------------------------------------------------
const KeysMixin = ( BaseClass ) => class extends BaseClass {
	constructor( options = {} ){
		super( options );
		this.keyState = {};
		if( options.monitorKeys ) this.monitorKeys();
	}

	monitorKeys(){
		const target = this.options.globalKeys ? window : this.el;
		target.addEventListener('keydown', this._onKeyDown.bind(this));
		target.addEventListener('keyup', this._onKeyUp.bind(this));
	}

	_onKeyDown( e ){
		this.keyState[e.code] = true;
		this.trigger('keydown', e);
		this._executeKeyAction(e);
	}

	_onKeyUp( e ){
		this.keyState[e.code] = false;
		this.trigger('keyup', e);
	}

	_executeKeyAction( e ){
		if( !this.keys ) return;
		const methodName = this.keys[e.code] || this.keys[e.key];
		if( methodName && typeof this[methodName] === 'function' ){
			this[methodName](e);
		}
	}

	isKeyHeld( code ){
		return !!this.keyState[code];
	}
};

/*
 * Events
 * An application-wide, decoupled pub/sub bus (the mediator pattern). Publishers
 * and subscribers rendezvous on named events without holding a reference to one
 * another - unlike Base's on/trigger, which observe a specific object.
 *
 * Events are delivered in-page immediately (via the Base event registry) and,
 * when available, mirrored to other tabs/windows of the same origin using a
 * BroadcastChannel. Cross-tab payloads are structured-cloned, so non-cloneable
 * values (functions, DOM nodes, class instances) are delivered locally only.
 *
 *   const bus = new Events("app");
 *   bus.on("slideshow:next", (frame) => caption.show(frame)); // decoupled
 *   bus.trigger("slideshow:next", 3);   // local listeners + other tabs
 *
 * Copyright © Makesites.org
 */

class Events extends Base {

	/**
	 * @param {string} [name="app"] - channel/topic namespace (also the BroadcastChannel name)
	 * @param {{broadcast?: boolean}} [options] - set broadcast:false to disable cross-tab
	 */
	constructor( name, options ){
		// fallback(s)
		options = options || {};
		super( options );
		// the channel name (topic namespace)
		this.name = name || "app";
		// bridge to other browsing contexts unless disabled / unavailable
		this.broadcast = ( options.broadcast !== false ) && ( typeof BroadcastChannel !== "undefined" );
		if( this.broadcast ){
			this._channel = new BroadcastChannel( this.name );
			var self = this;
			this._channel.addEventListener("message", function( e ){
				var msg = e.data || {};
				// re-emit a remote event to local listeners only (no re-broadcast)
				self._emit( msg.event, msg.args || [] );
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
	trigger( name ){
		var args = Array.prototype.slice.call( arguments, 1 );
		// local, same-tab delivery
		this._emit( name, args );
		// cross-tab delivery (structured-clone; stays local-only if not cloneable)
		if( this._channel ){
			try {
				this._channel.postMessage({ event: name, args: args });
			} catch( e ){
				// payload not structured-cloneable - already delivered locally
			}
		}
		return this;
	}

	// deliver to local listeners via the Base registry (without re-broadcasting)
	_emit( name, args ){
		return Base.prototype.trigger.apply( this, [name].concat( args ) );
	}

	// tear down the cross-tab channel and drop all listeners
	close(){
		if( this._channel ) this._channel.close();
		this._channel = null;
		this.off();
	}
}

// utilities
class Utils {

	constructor() {

		// Helpers
		// this is to enable {{moustache}} syntax to simple _.template() calls
		this.templateSettings = {
			interpolate : /\{\{(.+?)\}\}/g,
			variable : "."
		};

		// if available, use the Handlebars compiler
		if(typeof Handlebars != "undefined"){
			// use `this` - the global `_` isn't assigned yet during construction
			this.mixin({
				template : Handlebars.compile
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
	extend( destination ){
		destination = destination || {};
		var sources = Array.prototype.slice.call( arguments, 1 );
		for( var i = 0; i < sources.length; i++ ){
			var source = sources[i];
			if( !source ) continue;
			for( var key in source ){
				if( Object.prototype.hasOwnProperty.call( source, key ) ){
					destination[key] = source[key];
				}
			}
		}
		return destination;
	}

	uuid(){
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
			return v.toString(16);
		});
	}

	// - Support Phonegap Shim: https://github.com/makesites/phonegap-shim
	isPhonegap(){
		// only execute in app mode?
		return typeof PhoneGap != "undefined" && typeof PhoneGap.init != "undefined" && typeof PhoneGap.env != "undefined"  && PhoneGap.env.app;
	}

/*
	isUndefined( obj ){
		return (typeof obj == "undefined");
	}
*/

	// Source: https://www.30secondsofcode.org/js/s/bind-all/
	bindAll( context, ...methods ){
		methods.forEach(function( fn ){
			let f = context[fn];
			context[fn] = function() {
				return f.apply(context);
			};
		});
	}

	// Source: https://locutus.io/php/var/empty/
	isEmpty( mixedVar ){
		let key;
		let i;
		let len;
		const emptyValues = [undefined, null, false, 0, '', '0'];
		for (i = 0, len = emptyValues.length; i < len; i++) {
			if (mixedVar === emptyValues[i]) {
				return true;
			}
		}
		if (typeof mixedVar === 'object') {
			for (key in mixedVar) {
				if (Object.prototype.hasOwnProperty.call(mixedVar, key)) {
					return false;
				}
			}
			return true;
		}
		return false;
	}

	isString( v ){
		return (typeof v == "string");
	}

	getSiblings (elem) {

		// Setup siblings array and get the first sibling
		var siblings = [];
		var sibling = elem.parentNode.firstChild;

		// Loop through each sibling and push to the array
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
	uniqueId( prefix ){
		this._idCounter = ( this._idCounter || 0 ) + 1;
		return ( prefix ? prefix + "-" : "" ) + this._idCounter;
	}


	// ---
	// Underscore.js methods
	// Source: http://underscorejs.org/

	isNull(obj) {
		return obj === null;
	}

	isUndefined( obj ){
		return obj === void 0;
	}

	// Traverses the children of `obj` along `path`. If a child is a function, it
	// is invoked with its parent as context. Returns the value of the final
	// child, or `fallback` if any child is undefined.
	result( obj, path, fallback ){
		path = ( Array.isArray(path) ) ? path : [path];
		var length = path.length;
		if (!length) {
			return (typeof fallback === 'function') ? fallback.call(obj) : fallback;
		}
		for (var i = 0; i < length; i++) {
			var prop = obj == null ? void 0 : obj[path[i]];
			if (prop === void 0) {
				prop = fallback;
				i = length; // Ensure we don't continue iterating.
			}
			obj = (typeof prop === 'function') ? prop.call(obj) : prop;
		}
		return obj;
	}

	// ---
	// Additional Underscore.js replacements (previously required the library)

	// iterate over a list or an object's own values
	each( obj, fn, context ){
		if( obj == null ) return obj;
		if( Array.isArray(obj) ){
			for( var i = 0; i < obj.length; i++ ) fn.call(context, obj[i], i, obj);
		} else {
			for( var key in obj ) fn.call(context, obj[key], key, obj);
		}
		return obj;
	}

	// bind a function to a context (native)
	bind( fn, context ){
		return fn.bind(context);
	}

	// return a function that only runs after being called `times` times
	after( times, fn ){
		return function(){
			if( --times < 1 ) return fn.apply(this, arguments);
		};
	}

	// return a function that runs at most once, memoising the result
	once( fn ){
		var called = false, result;
		return function(){
			if( !called ){
				called = true;
				result = fn.apply(this, arguments);
			}
			return result;
		};
	}

	// the own-enumerable keys of an object
	keys( obj ){
		return ( obj == null ) ? [] : Object.keys(obj);
	}

	isFunction( obj ){
		return typeof obj === "function";
	}

	// Can `obj[name] = value` succeed? False when the name resolves to an
	// accessor with no setter anywhere on the prototype chain - assigning to one
	// throws in strict mode (all ES modules are strict), which is what broke
	// subclass getters before the resolve-merge lifecycle of commit 27. Use this
	// where a public name genuinely has to be assigned rather than resolved.
	assignable( obj, name ){
		var target = obj;
		while( target ){
			var descriptor = Object.getOwnPropertyDescriptor( target, name );
			if( descriptor ) return !!( descriptor.writable || descriptor.set );
			target = Object.getPrototypeOf( target );
		}
		// not declared anywhere - a plain assignment creates it
		return true;
	}

	// shallow value equality: strict for primitives, JSON for plain objects/arrays
	// (guarded, so circular structures compare unequal rather than throwing)
	isEqual( a, b ){
		if( a === b ) return true;
		if( a === null || b === null || typeof a !== "object" || typeof b !== "object" ) return false;
		try { return JSON.stringify(a) === JSON.stringify(b); } catch(e){ return false; }
	}

	// copy the properties of `obj` onto this utils instance (used to register a
	// template compiler, e.g. Handlebars)
	mixin( obj ){
		for( var key in obj ) this[key] = obj[key];
		return this;
	}

}


//import { Model } from "./model.js";
//import { View } from "./view.js";
//import { Controller } from "./controller.js";
//import { Collection } from "./collection.js";
//import { Layout } from "./layout.js";

// Device / environment state. Owned by the APP facade (was built inside the
// Controller). SSR-safe: the eagerly-evaluated flags guard their globals so the
// object can be created outside a browser.
function createState(){
	var hasNav = ( typeof navigator !== "undefined" );
	var hasWin = ( typeof window !== "undefined" );
	var hasDoc = ( typeof document !== "undefined" );
	return {
		fullscreen: false,
		online: ( hasNav && ("onLine" in navigator) ) ? navigator.onLine : true,
		// find browser type
		browser: function(){
			if( !hasNav ) return 'other';
			if( /chrome/.test(navigator.userAgent.toLowerCase()) ) return 'chrome';
			if( /firefox/.test(navigator.userAgent.toLowerCase()) ) return 'firefox';
			if( /safari/.test(navigator.userAgent.toLowerCase()) ) return 'safari';
			if (navigator.appName == 'Microsoft Internet Explorer') return 'ie';
			if( /android/.test(navigator.userAgent.toLowerCase()) ) return 'android';
			if(/(iPhone|iPod).*OS 5.*AppleWebKit.*Mobile.*Safari/.test(navigator.userAgent) ) return 'ios';
			if (navigator.userAgent.indexOf("Opera Mini") !== -1) return 'opera-mini';
			return 'other';
		},
		mobile: hasNav ? (navigator.userAgent.match(/Android/i) || navigator.userAgent.match(/webOS/i) || navigator.userAgent.match(/iPhone/i) || navigator.userAgent.match(/iPod/i) ||navigator.userAgent.match(/BlackBerry/i)) : false,
		ipad: hasNav ? (navigator.userAgent.match(/iPad/i) !== null) : false,
		retina: hasWin ? (window.retina || window.devicePixelRatio > 1) : false,
		// check if there's a touch screen
		touch : hasDoc ? ('ontouchstart' in document.documentElement) : false,
		pushstate: function() {
			try {
				window.history.pushState({"pageTitle": document.title}, document.title, window.location);
				return true;
			}
			catch (e) {
				return false;
			}
		},
		scroll: true,
		ram: function(){
			return (typeof console !== "undefined" && console.memory) ? Math.round( 100 * (console.memory.usedJSHeapSize / console.memory.totalJSHeapSize)) : 0;
		},
		standalone: function(){ return (typeof navigator !== "undefined" && ("standalone" in navigator) && navigator.standalone) || (typeof PhoneGap !="undefined" && !_.isUndefined(PhoneGap.env) && PhoneGap.env.app ) || ((typeof external != "undefined") && (typeof external.msIsSiteMode == "function") && external.msIsSiteMode()); },
		framed: ( typeof self !== "undefined" && typeof top !== "undefined" ) ? (top !== self) : false
	};
}

// A lightweight registry of the app's mounted views.
class Views {

	constructor(){
		this._views = {};
	}

	add( name, view ){
		this._views[name] = view;
		return view;
	}

	get( name ){
		return this._views[name];
	}

	remove( name ){
		var view = this._views[name];
		if( view && typeof view.remove === "function" ) view.remove();
		delete this._views[name];
		return this;
	}

	each( fn ){
		for( var key in this._views ) fn( this._views[key], key );
		return this;
	}

	get all(){
		return this._views;
	}
}


/**
 * Application facade. `new APP()` returns this object; its sub-objects
 * (events/state/views/session) are ready synchronously, while `router` resolves
 * asynchronously - await {@link APP#ready}.
 * @property {Events} events - the shared, decoupled, cross-tab event bus
 * @property {Object} state - device/environment state (online, touch, mobile, ...)
 * @property {Views} views - registry of mounted views
 * @property {?Session} session - the app session (when options.session is set)
 * @property {?Controller} router - the resolved controller (available after `ready`)
 * @property {Promise<APP>} ready - resolves once the router is loaded
 */
class APP {

	/**
	 * @param {Object} [options]
	 * @param {boolean} [options.pushState] - use the History pushState API
	 * @param {string[]} [options.controllers] - controller names available to lazy-import
	 * @param {Object} [options.session] - session config (enables app.session)
	 */
	constructor( options ) {
		// fallback(s)
		options = ( options && typeof options === "object" ) ? options : {};
		this.name = 'APP';
		// config defaults
		options.routePath = options.routePath || "app/controllers/";
		options.pushState = options.pushState || false;
		this.options = options;
		// internal
		this._routes = [];
		// legacy alias
		this.Routers = APP.Controllers;

		// --- sub-objects (ready synchronously) ---
		// device / environment state
		this.state = createState();
		// shared, decoupled, cross-tab event bus
		this.events = new Events("app");
		// registry of mounted views
		this.views = new Views();
		// authentication session (created when configured)
		this.session = options.session ? new APP.Session( {}, options.session ) : null;
		// the router/controller is resolved asynchronously (see start())
		this.router = null;

		// expose on the global so UI (Model/Collection/Layout) can reach app.state
		if( typeof window !== "undefined" ) window.app = this;

		// auto-start; `app.ready` resolves once the router is in place
		this.ready = this.start();
	}

	// Resolve the controller and wire it to the app. Returns the facade.
	async start(){
		this.router = await this._resolveController();
		if( this.router ){
			// give the controller a back-reference to the app
			this.router.app = this;
		}
		return this;
	}

	// Find and instantiate the controller: registered synchronously in
	// APP.Controllers, or lazily imported (route-based code splitting), falling
	// back to the default Controller.
	async _resolveController(){
		var options = this.options;
		// the first path segment selects the controller
		var path = ( typeof window !== "undefined" ) ? window.location.pathname.split("/") : [];
		if( path[0] === "" ) path.shift();
		var route = ( !_.isEmpty(path[0]) ) ? path[0] : "default";
		var ucRoute = route.charAt(0).toUpperCase() + route.slice(1);
		// pass the app reference into the controller
		options.app = this;

		// 1. registered synchronously
		if( typeof APP.Controllers[ucRoute] === "function" ) return new APP.Controllers[ucRoute]( options );

		// 2. lazily imported (route-based code splitting)
		var list = options.controllers || [];
		if( list.includes(route) || list.includes("default") ){
			var name = list.includes(route) ? route : "default";
			var uc = name.charAt(0).toUpperCase() + name.slice(1);
			try {
				var module = await import( "../" + options.routePath + name + ".js" );
				var Ctrl = module[uc] || module.Default || module.Router || APP.Controller;
				return new Ctrl( options );
			} catch( error ){
				console.error( error );
				return new ( APP.Controllers.Default || APP.Controller )( options );
			}
		}

		// 3. fallback to a registered Default controller, else the base Controller
		return new ( APP.Controllers.Default || APP.Controller )( options );
	}

	routes() {
		return this._routes;
	}
}


// DOM-ready helper (static: APP.ready( callback )). Distinct from the instance
// `app.ready` promise, which resolves when the router has loaded.
// Source: https://gist.github.com/tracend/5617079
APP.ready = function( callback ){
	if( _.isPhonegap() ){
		return PhoneGap.init( callback );
	} else if( typeof document !== "undefined" && document.readyState !== "loading" ){
		// the DOM is already ready - run on the next tick
		return setTimeout( callback, 0 );
	} else if( typeof document !== "undefined" ){
		// native DOM-ready (replaces jQuery's $(document).ready)
		return document.addEventListener("DOMContentLoaded", callback);
	}
};


// Base Classes
APP.Model = Model;
APP.View = View;
APP.Controller = Controller;
APP.Router = Router;
APP.Template = Template;
APP.Collection = Collection;
APP.Layout = Layout;
APP.Session = Session;
APP.Events = Events;

// The global history singleton
APP.history = history;

// Namespace containers
APP.Models = {};
APP.Controllers = {};
APP.Collections = {};
APP.Views = {};
APP.Layouts = {};
APP.Templates = {};



// Initialize utilities
// convention carried from the legacy underscore.js
var _ = new Utils();

// expose on the global (guarded so the bundle also imports under Node/SSR)
if ( typeof window !== "undefined" ) window.APP = APP;

export { APP, Model, View, Controller, Router, history, Events, Collection, Layout, Template, Session, sync };
export { TouchMixin, MouseMixin, ScrollMixin, MotionMixin, GamepadMixin, KeysMixin };

//# sourceMappingURL=app.js.map
