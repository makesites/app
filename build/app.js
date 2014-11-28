/**
 * @name app
 * APP constructor with common classes for application development
 *
 * Version: 0.2.0 (Fri, 28 Nov 2014 00:34:09 GMT)
 * Source: http://github.com/makesites/app
 *
 * @author makesites
 * Initiated by: Makis Tracend (@tracend)
 * Distributed through [Makesites.org](http://makesites.org)
 *
 * @cc_on Copyright Â© Makesites.org
 * @license Released under the [APACHE-2.0 license](http://makesites.org/licenses/APACHE-2.0)
 */

(function (lib) {

	//"use strict";

	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		var deps = ['jquery', 'underscore', 'backbone'];
		define("backbone.app", deps, lib); // give the module a name
	} else if ( typeof module === "object" && module && typeof module.exports === "object" ){
		// Expose as module.exports in loaders that implement CommonJS module pattern.
		module.exports = lib;
	} else {
		// Browser globals
		var Query = window.jQuery || window.Zepto || window.vQuery;
		lib(Query, window._, window.Backbone, window.APP);
	}
}(function ($, _, Backbone) {

	//"use strict";
	// better way to define global scope?
	var window = this.window || {};
	var APP = window.APP || false;

	// stop processing if APP is already part of the namespace
	if( !APP ) (function(_, Backbone) {

	// App contructor
	APP = function(){
		// get config
		var options = arguments[0] || {};
		var callback = arguments[1] || function(){};
		// defaults
		options.require = options.require || (typeof define === 'function' && define.amd);
		options.routePath = "app/controllers/";
		options.pushState = options.pushState || false;
		// find router
		var router = false;
		// check URIs
		var path = window.location.pathname.split( '/' );
		// FIX: discart the first item if it's empty
		if ( path[0] === "" ) path.shift();
		//
		if( options.require ){
			// use require.js
			var routerDefault = options.routePath +"default";
			if(typeof options.require == "string"){
				router = options.require;
			} else {
				router = options.routePath;
				router += ( !_.isEmpty(path[0]) ) ? path[0] : "default";
			}
			require( [ router ], function( controller ){
				if( controller ){
					callback( controller );
				}
			}, function (err) {
				//The errback, error callback
				//The error has a list of modules that failed
				var failed = err.requireModules && err.requireModules[0];
				// what if there's no controller???
				if( failed == router ){
					// fallback to the default controller
					require( [ routerDefault ], function( controller ){
						callback( controller );
					});
				} else {
					//Some other error. Maybe show message to the user.
					throw err;
				}
			});

			return APP;

		} else {
			// find a router based on the path
			for(var i in path ){
				// discart the first item if it's empty
				if( path[i] === "") continue;
				router = (path[i].charAt(0).toUpperCase() + path[i].slice(1));
				// stop if we've found a router
				if(typeof(APP.Routers[router]) == "function") break;
			}
			// call the router or fallback to the default
			var controller = (router && APP.Routers[router]) ? new APP.Routers[router]( options ) : new APP.Routers.Default( options );
			// return controller so it's accessible through the app global
			return controller;
		}
	};

	// Namespace definition
	APP.Models = {};
	APP.Routers = {};
	APP.Collections = {};
	APP.Views = {};
	APP.Layouts = {};
	APP.Templates = {};

	})(this._, this.Backbone);

	/*
	class APP {

		name: 'APP'
		// internal
		_routes: []

		constructor() {

		}

		routes() {
			return this._routes;
		}

	}
	*/

(function(APP) {

	class Collection {
		constructor() {

		}
	}

	APP.Collection = Collection;

})(this.APP);
(function(APP) {

	class Controller {
		constructor() {

		}

		routes: {

		}
	}

	APP.Controller = Controller;

})(this.APP);
(function(APP) {

	class Layout {
		constructor() {

		}
	}

	APP.Layout = Layout;

})(this.APP);
(function(APP) {

	class Model {
		constructor() {

		}
	}

	APP.Model = Model;

})(this.APP);
(function(APP) {

	class Template {
		constructor() {

		}
	}

	APP.Template = Template;

})(this.APP);
/*
// Helper classes

class Main extends Controller {
	constructor() {

	}
}

*/
(function(APP) {

	class View {
		constructor() {

		}
	}

	APP.View = View;

})(this.APP);

	// If there is a window object, that at least has a document property
	if( typeof window === "object" && typeof window.document === "object" ){
		// save in the global namespace
		window.APP = APP;
	}

	// ES 6
	module "app" {
		export APP
	}
	// for module loaders:
	return APP;

}));
