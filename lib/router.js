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
		// dedicated event target (parity with Model/View)
		this._e = new EventTarget();
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
		// dedicated event target
		this._e = new EventTarget();
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
