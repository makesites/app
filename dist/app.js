/**
 * @name @makesites/app
 * A lightweight, ES6 client-side application framework
 *
 * Version: 0.6.5 (built)
 * Source: http://github.com/makesites/app
 *
 * @author makesites
 * Distributed by [Makesites.org](http://makesites.org)
 *
 * @license Released under the MPL v2.0, AGPL v3.0 licenses
 */









class Base {

	constructor( options ){
		// fallback(s)
		options = options || {};
		// variables
		this.states = options.states || {}; // delete options.states?

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
		// stop resize monitoring
		window.removeEventListener( "resize", this._resize );

		// don't forget to call the original remove() function
		//Backbone.View.prototype.remove.call(this);
	}

	unbind( name, cb ){
		if( !name ){
			// Remove all event listeners from Element by cloning it
			this.el.replaceWith( this.el.cloneNode(true) );
		} else if( !cb ) {
			// remove specific event
			this.el.removeEventListener( name );
		} else {
			// remove specific event
			this.el.removeEventListener( name, cb );
		}
	}

	delegateEvents( events ){
		events =  events || _.result(this, 'events');
		var self = this;
		var delegateEventSplitter = /^(\S+)\s*(.*)$/;
		if (!events) return this;
		// listeners list
		this._delegateEvents = [];
		this.undelegateEvents();
		const enames = Object.keys(events);
		enames.forEach(key => {
			var method = events[key];
			if( typeof method !== 'function' ) method = this[method];
			if( !method ) return;
			var match = key.match(delegateEventSplitter);
			self.el.querySelectorAll(match[2]).forEach( function(el){
				let type = match[1] + '.delegateEvents' + self.cid;
				let listener = method.bind(self);
				el.addEventListener( type, listener );
				self._delegateEvents.push({target: self, type: type, listener: listener});
			});
		});
		return this;
	}

	// Source: https://stackoverflow.com/a/47117084
	undelegateEvents(){

		let _listeners = this._delegateEvents || [];
		for( var index = 0; index != _listeners.length; index++ ){
			var item = _listeners[index];

			var target = item.target;
			var type = item.type;
			var listener = item.listener;

			if(target == this && type.indexOf('.delegateEvents'+this.cid) > -1){
				this.el.removeEventListener(type, listener);
			}
		}
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
		for(var e in this.states){
			var method = this.states[e];
			this.bind(e, _.bind(this[method], this) );
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
const escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

// Cached regexes for stripping urls of hash and root.
const routeStripper = /^[#\/]|\s+$/g;
const rootStripper  = /^\/+|\/+$/g;
const pathStripper  = /#.*$/;


class Router extends Base {

	constructor( options ){
		// fallback(s)
		options = options || {};
		super( options );
		// events are inherited from Base (on/once/off/trigger/bind)
		// routes can be passed in as an option
		if( options.routes ) this.routes = options.routes;
	}

	initialize(){}

	// Bind all defined routes to `history`.
	_bindRoutes(){
		if( !this.routes ) return;
		this.routes = _.result( this, "routes" );
		var route, routes = Object.keys( this.routes );
		while( (route = routes.pop()) != null ){
			this.route( route, this.routes[route] );
		}
	}

	// Manually create a route for the router.
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

	// Execute a route handler with the provided parameters. Override to add
	// pre/post-route logic (e.g. route guards) - returning `false` cancels.
	execute( callback, args, name ){
		if( callback ) callback.apply( this, args );
	}

	// Simple proxy to `history` to save a fragment into the history.
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
		var path = this.location.pathname.replace(/[^\/]$/, "$&/");
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

		this.defaults = {
			autofetch: false,
			cache: false
		};

		this.attributes = {};

		// save options for later
		options = options || {};
		this.options = _.extend({}, this.defaults, options);
		// set data if given
		//if( !_.isNull( model ) && !_.isEmpty( model ) ) this.set( model );
		if( typeof model == "object" ) this.set( model );

		this.cid = _.uniqueId("model");

		this.initialize();
	}

	// initialization
	initialize(){
		// restore cache
		if( this.options.cache ){
			var cache = this.cache();
			if( cache ) this.set( cache );
		}
		// auto-fetch if no models are passed
		if( this.options.autofetch && !_.isUndefined(this.url) ){
				this.fetch();
		}
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

	// Get the value of an attribute.
	get( attr ){
		return this.attributes[attr];
	}

	has( attr ){
		return this.get(attr) != null;
	}

	// Set a hash of model attributes on the object, firing `"change"`.
	// Based on Backbone.js Model.set
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

		// Extract attributes and options.
		var silent = options.silent;
		var changes = [];

		// For each `set` attribute, update the value if it actually changed.
		for( var attr in attrs ){
			val = attrs[attr];
			var prev = this.attributes[attr];
			// compare: strict for primitives, JSON for plain objects/arrays.
			// JSON.stringify throws on circular structures (DOM nodes, view
			// instances) - in that case assume the value changed.
			var changed;
			if( val !== null && typeof val === "object" ){
				try { changed = JSON.stringify(prev) !== JSON.stringify(val); }
				catch( e ){ changed = true; }
			} else {
				changed = prev !== val;
			}
			if( changed ){
				this.attributes[attr] = val;
				changes.push( attr );
			}
		}

		// fire granular change:<attr> events, then a single change
		if( !silent && changes.length ){
			for( var i = 0; i < changes.length; i++ ){
				this.trigger( 'change:' + changes[i], this, this.attributes[ changes[i] ], options );
			}
			this.trigger( 'change', this, options );
		}

		return this;
	}

	// #63 reset model to its default values
	reset(){
		return this.clear().set(this.defaults);
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
		// no storage engine available, nothing to do
		if( typeof localStorage === "undefined" ) return false;
		var opts = ( this.options && this.options.cacheOptions ) || {};
		var name = opts.cache_key || this.name || "model";
		// SET
		if( data ){
			// namespace by id when available
			if( data.id ) name += "_" + data.id;
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
		if( this.get("id") ) name += "_" + this.get("id");
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

	// a model is considered "new" until it has been assigned an id
	isNew(){
		return !this.has("id");
	}

	// fetch the model from the server
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

	// save the model to the server (create or update based on isNew)
	save( attrs, options ){
		options = options || {};
		// optimistically set the attributes locally
		if( attrs ) this.set( attrs, options );
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
	isOnline(){
		return ( !_.isUndefined( app ) ) ? app.state.online : true;
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
		// find the data
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
		// A simple state machine for views.
		this.states = {
			"scroll": "_scroll"
		};

		this.defaults = {
			data : false,
			html: false,
			template: false,
			url : false,
			bind: "add remove reset change", // change the default to "sync"?
			type: false,
			parentEl : false,
			autoRender: true,
			inRender: false,
			silentRender: false,
			renderTarget: false
		};
		// events are inherited from Base (on/once/off/trigger/bind)
		this.events = {
			"click a[rel='external']" : "clickExternal"
		};

		//  extend options
		this.options = _.extend({}, this.defaults, options);
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
		// proxy internal method for future requests
		this.url = this._url;
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
		// #36 - Adding resize event
		window.addEventListener("resize", this._resize.bind(this) );
		// monitor viewport visibility natively (replaces the jQuery scroll math)
		this._setupVisibilityObserver();

		this.initStates();
		// initiate parent (states etc.)
		//return Backbone.View.prototype.initialize.call( this, options );
		//return View.prototype.initialize.call(this, options);
	}

	initStates(){
		for(var e in this.states){
			var method = this.states[e];
			this.bind(e, this[method].bind(this) );
		}
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

	// Render view
	// placing markup in the DOM
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
		// by default
		var container = this.el;

		if ( !this.options.renderTarget ){
			// do nothing more

		} else if( typeof this.options.renderTarget == "string" ){

			container = this.el.querySelectorAll(this.options.renderTarget)[0];
			if( !container.length ){
				// assume this always exists...
				container = document.querySelector(this.options.renderTarget);
			}

		} else if( typeof this.options.renderTarget == "object" ){

			container = this.options.renderTarget;

		}

		return container;

	}

	// checks if an element exists in the DOM
	_inDOM( el ){
		// fallbacks
		el = el || this.el;
		// prerequisites
		if( !el ) return false;
		// variables
		var exists = false;
		var parent = document.querySelector( (this.options.parentEl || "body") );
		// check parent element
		exists = parent.contains( el );
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

	// resize event trigger (with debouncer)
	_resize () {
		var self = this ,
		args = arguments,
		timeout,
		delay = 1000; // default delay set to a second
		clearTimeout( timeout );
		timeout = setTimeout( function () {
			self.resize.apply( self , Array.prototype.slice.call( args ) );
		} , delay);
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

	// tidy up the view: drop event bindings, stop observing, detach from the DOM
	remove(){
		// remove all listenTo bindings (data, template, ...) to avoid leaks
		this.stopListening();
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

		// defaults
		this.routes = {};

		this.data = new Model();

		// app configuration:
		this.defaults = {
			api : false,
			autostart: true,
			location : false,
			pushState: false,
			p404 : "/"
		};

		// app config refered to as options
		options = options || {};
		// extend default options (recursive?)
		//this.options = _.extend({}, this.defaults, options);
		this.options = _.extend({}, this.defaults, options);

		// to preserve these routes, extend with:
		// _.extend({}, APP.Router.prototype.routes, {...});
		this.routes = {
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
		if (!this.routes) return;
		this.routes = _.result(this, 'routes');
		var route, routes = Object.keys(this.routes);
		while(typeof (route = routes.pop()) !== "undefined"){
			var name = this.routes[route];
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

		// defaults
		this.defaults = {
			_synced : false,
			autofetch: false,
			cache: false
		};

		// the "item" of the collection can be defined on instantiation or default ot the base Model
		this.model = options.model || Model;
		// at it's core the collection is a "dumb" array of data that we will perform operations on.
		this.data = [];

		// merge options
		options = options || {};
		//this.options = this.constructor.defaults;
		this.options = _.extend( {}, this.defaults, options );
		//this.options = _.extend({}, this.defaults, options);
		//...

		this.cid = _.uniqueId("collection");

		this.initialize();
	}

	// initialization
	initialize(){
		// restore cache
		if( this.options.cache ){
			var cache = this.cache();
			if( cache ) this.add( cache );
		}
		// auto-fetch if no models are passed
		if( this.options.autofetch && _.isEmpty(models) && this.url ){
			this.fetch();
		}
	}
/*
	render(){

	}
*/
	update(){

	}

	// adds one - or many - models to the collection
	add( data ) {
		// support adding multiple models at once
		if( Array.isArray( data ) ){
			var self = this;
			return data.forEach(function( item ){ self.add( item ); });
		}
		// check if the supplied data is already a model
		var model = ( data && data.cid && data.cid.includes("model") ) ? data : new this.model( data );
		// add at the end of the models array
		this.data.push( model );
		return model;
	}

	// to add multiple models
	save(models, options){
		// merge models
		_.extend(this.models, models);
		// callback is run once, after all models have saved.
		if( options.success ){
			var callback = _.after(this.models.length, options.success);
			_.each( this.models, function( model ){
				model.save(null, {success: callback});
			});
		}
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
			// populate the collection from the response
			if( Array.isArray( data ) ){
				data.forEach(function( item ){ self.add( item ); });
			} else if( data ) {
				self.add( data );
			}
			self.options._synced = true;
			if( success ) success.call( options.context, self, resp, options );
			self.trigger("sync", self, resp, options);
		};
		return this.sync("read", this, options);
	}

	// retrieve a single model
	get( key ) {
		// if the key is an integer return the item with that "array" index
		if( Number.isInteger( key ) ) {
			return this.data[ key ];
			// if this.data is an object this can still work with Object.values(this.data) ...
		}
		// the key can eithe rbe the id, name or cid of a specific model
		// we need to loop through the data and check for all attributes
		for ( var i in this.data ){
			if( key === this.data[i].get('id') ) return this.data[i];
			if( key === this.data[i].get('name') ) return this.data[i];
			if( key === this.data[i].get('cid') ) return this.data[i];
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
		if( typeof localStorage === "undefined" ) return false;
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
	isOnline(){
		return ( !_.isUndefined( app ) ) ? app.state.online : true;
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
		var value = false;
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

		// pick a persistance solution
		if( !this.options.persist && typeof sessionStorage != "undefined" && sessionStorage !== null ){
			// choose localStorage
			this.store = sessionStore;
		} else if( this.options.persist && typeof localStorage != "undefined" && localStorage !== null ){
			// choose localStorage
			this.store = localStore;
		} else {
			// otherwise we need to store data in a cookie
			this.store = cookieStore;
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
let sessionStore = {
	get : function( name ) {
		return sessionStorage.getItem( name );
	},
	set : function( name, val ){
		// validation first?
		return sessionStorage.setItem( name, val );
	},
	check : function( name ){
		return ( sessionStorage.getItem( name ) == null );
	},
	clear: function( name ){
		// actually just removing the session...
		return sessionStorage.removeItem( name );
	}
};

let localStore = {
	get : function( name ) {
		return localStorage.getItem( name );
	},
	set : function( name, val ){
		// validation first?
		return localStorage.setItem( name, val );
	},
	check : function( name ){
		return ( localStorage.getItem( name ) == null );
	},
	clear: function( name ){
		// actually just removing the session...
		return localStorage.removeItem( name );
	}
};

let cookieStore = {
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
	},

	set : function( name, val ){
		// automatically expire session in a day
		var expiry = 86400000;
		var date = new Date( Date.now() + parseInt(expiry) );
		var value = encodeURIComponent(val) + "; expires=" + date.toUTCString();
		document.cookie = name + "=" + value;
	},

	check : function( name ){
		var cookie=this.get( name );
		if (cookie!=null && cookie!=""){
			return true;
		} else {
			return false;
		}
	},

	clear: function( name ) {
		document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
	}
};


class Template extends Model {

	constructor( html, options ) {
		// fallback(s)
		options = options || (options={});
		html = html || "";
		// pass options as Model *options* (not as model attributes) so this.options
		// carries url/type/compiler. (Was `super(options)`, which mis-routed them
		// into attributes and left this.options.url undefined - the remote-template
		// url branch never fired.)
		super({}, options);

		this.html = html;

		this.cid = _.uniqueId("template");

		this.initialize();
	}

	initialize(){
		// fallback for options
		var html = this.html;

		if( !_.isEmpty(html) ){
			this.set( "default", this.compile( html ) );
			this.trigger("loaded");
		}
		//if( !_.isUndefined( options.url ) && !_.isEmpty( options.url ) ){
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
		// main function
		var template = function( data ){
			data = data || {};
			const keys = Object.keys( data );
			// HTML-escape string values before they are interpolated into the markup
			const values = keys.map(function( key ){
				var v = data[key];
				return ( typeof v === "string" ) ? escape( v ) : v;
			});
			const fn = new Function(...keys, 'return `' + cleanMarkup + '`');

			return fn(...values);
		};

		//template.bind( this );

		return template;
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
var store = {
	get   : function( name ){ return localStorage.getItem( name ); },
	set   : function( name, val ){ return localStorage.setItem( name, val ); },
	check : function( name ){ return localStorage.getItem( name ) === null; },
	clear : function( name ){ return localStorage.removeItem( name ); }
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

// Persists the state of a model/collection to the server using the native
// fetch() API. Returns a Promise that resolves with the parsed response and
// still fires the legacy success/error callbacks the components rely on.
async function sync( method, model, options ){
	// fallback(s)
	options = options || {};
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

	// let listeners know a request is under way (parity with Backbone)
	model.trigger("request", model, null, options);

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

	} catch( error ){
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

	// publish an event: deliver to local listeners and (optionally) other tabs
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
		let undef;
		let key;
		let i;
		let len;
		const emptyValues = [undef, null, false, 0, '', '0'];
		for (i = 0, len = emptyValues.length; i < len; i++) {
			if (mixedVar === emptyValues[i]) {
				return true;
			}
		}
		if (typeof mixedVar === 'object') {
			for (key in mixedVar) {
				if (mixedVar.hasOwnProperty(key)) {
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

	// Based on uniqueCode.js (with a prefix)
	// Source: https://gist.github.com/tracend/8203090
	uniqueId( prefix ){
		// fallback
		prefix = prefix+"-" || "";
		// variables
		var characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
		var ticks = (new Date()).getTime().toString();
		var code = "";
		for (var i = 0; i < characters.length; i += 2) {
			if ((i + 2) <= ticks.length) {
				var number = parseInt(ticks.substr(i, 2));
				if (number > characters.length - 1) {
					var one = number.toString().substr(0, 1);
					var two = number.toString().substr(1, 1);
					code += characters[parseInt(one)];
					code += characters[parseInt(two)];
				} else {
					code += characters[number];
				}
			}
		}
		return prefix + code;
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


// Application facade
// `new APP()` returns THIS object (not the controller). Its sub-objects -
// events, state, views, session - are ready synchronously; the router is
// resolved asynchronously, so await `app.ready` before using `app.router`.
class APP {

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
				return new APP.Controller( options );
			}
		}

		// 3. fallback to the default controller
		return new APP.Controller( options );
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
