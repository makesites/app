
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
