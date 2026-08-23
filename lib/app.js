import { Observable } from "./observable.js";
import { Model } from "./model.js";
import { View } from "./view.js";
import { Controller } from "./controller.js";
import { Router, history } from "./router.js";
import { Template } from "./template.js";
import { Collection } from "./collection.js";
import { Layout } from "./layout.js";
import { Session } from "./session.js";
import { Events } from "./events.js";
import { createState } from "./state.js";
import { Utils, _ } from "./utils.js";

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
				// Resolved by the browser at runtime, not by the bundler. The
				// specifier is built into a variable on purpose: given a literal
				// prefix (`import("../" + path)`) a bundler tries to *statically*
				// resolve it and pulls in every file it can reach - esbuild walked
				// the whole project. An opaque variable makes the intent explicit:
				// this is route-based code splitting, loaded from the deployed site.
				var specifier = "../" + options.routePath + name + ".js";
				var module = await import( /* @vite-ignore */ specifier );
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

// The global history singleton
APP.history = history;

// The shared utility belt (the same instance the framework classes use).
// Assigning it here is safe now: the import graph guarantees utils.js has been
// evaluated before this module body runs - under the old concatenation `_` was
// created after this file, so this line had to live in main.js.
APP._ = _;

// Namespace containers
APP.Models = {};
APP.Controllers = {};
APP.Collections = {};
APP.Views = {};
APP.Layouts = {};
APP.Templates = {};

export { APP, Views };
