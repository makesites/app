
//import { Model } from "./model.js";
//import { View } from "./view.js";
//import { Controller } from "./controller.js";
//import { Collection } from "./collection.js";
//import { Layout } from "./layout.js";

// Namespace definition
class APP {

	constructor() {

		this.name = 'APP';

		// internal
		this._routes = [];

		// get config
		var options = arguments[0] || {};
		var callback = arguments[1] || function(){};
		// defaults
		options.require = options.require || (typeof define === 'function' && define.amd);
		options.routePath = "app/controllers/";
		options.pushState = options.pushState || false;

		// save options
		this.options = options;

		// legacy
		this.Routers = this.Controllers;

		// find controller
		var controller = false;
		// check URIs
		var path = window.location.pathname.split( '/' );
		// FIX: discart the first item if it's empty
		if ( path[0] === "" ) path.shift();
		// default router
		var controllerDefault = options.routePath +"default";
		if(typeof options.require == "string"){
			controller = options.require;
		} else {
			controller = options.routePath;
			controller += ( !_.isEmpty(path[0]) ) ? path[0] : "default";
		}
		if( options.require ){
			// use require.js
			require( [ controller ], function( controller ){
				if( controller ){
					callback( controller );
				}
			}, function (err) {
				//The errback, error callback
				//The error has a list of modules that failed
				var failed = err.requireModules && err.requireModules[0];
				// what if there's no controller???
				if( failed == controller ){
					// fallback to the default controller
					require( [ controllerDefault ], function( controller ){
						callback( controller );
					});
				} else {
					//Some other error. Maybe show message to the user.
					throw err;
				}
			});

			return APP;

		} else {
			// use config to get list of available options
			var list = options.controllers || [];
			var route = ( !_.isEmpty(path[0]) ) ? path[0] : "default";

			if( list.includes(route) ){
				import("../"+ controller+'.js').then(module => {
					// Use the imported module here
					var ucRoute = route.charAt(0).toUpperCase() + route.slice(1);
					var Router = (typeof module[ucRoute] === "function") ? module[ucRoute] : module.Router; // more fallbacks
					this.route = new Router();
				}).catch(error => {
					// Handle errors here
					console.error(error);
				});
			} else if( list.includes("default") ){
				import( "../"+ controllerDefault+'.js').then(module => {
					// Use the imported module here
					var Router = (typeof module.Default === "function") ? module.Default : module.Router; // more fallbacks
					this.route = new Router();
				}).catch(error => {
					// Handle errors here
					console.error(error);
				});
				// check if there's a custom default controller
				//import * as CustomRouter from controllerDefault+".js";
				//this.route = new CustomRouter();
			} else {
				// fallback to the default router
				this.route = new APP.Controller();
			}

			// return controller so it's accessible through the app global
			return this.route;
		}
		// OLD version: global namespace lookup
		/*
		} else {
			// default controller
			var defaultController = (APP.Controllers.Default) ? APP.Controllers.Default : Controller;
			// find a controller based on the path
			for(var i in path ){
				// discart the first item if it's empty
				if( path[i] === "") continue;
				controller = (path[i].charAt(0).toUpperCase() + path[i].slice(1));
				// stop if we've found a controller
				if(typeof(APP.Controllers[controller]) == "function") break;
			}
			// call the controller or fallback to the default
			var route = (controller && APP.Controllers[controller]) ? new APP.Controllers[controller]( options ) : new defaultController( options );
			// return controller so it's accessible through the app global
			return route;
		}
		*/

	}

	routes() {
		return this._routes;
	}

	/*
	 * based on Backbone.ready()
	 * Source: https://gist.github.com/tracend/5617079
	 *
	 * by Makis Tracend( @tracend )
	 *
	 * Usage:
	 * APP.ready( callback );
	 *
	 */
	ready( callback ){

		if( _.isPhonegap() ){
			return PhoneGap.init( callback );

		} else if( $ ) {
			// use the 'default' ready event
			return $(document).ready( callback );

		} else if (window.addEventListener) {
			// ultimate fallback, add window event - trigger the page as soon it's loaded
			return window.addEventListener('load', callback, false);

		} else {
			// IE...
			return window.attachEvent('onload', callback);
		}

	}

}



// Base Classes
APP.Model = Model;
APP.View = View;
APP.Controller = Controller;
APP.Collection = Collection;
APP.Layout = Layout;

// Namespace containers
APP.Models = {};
APP.Controllers = {};
APP.Collections = {};
APP.Views = {};
APP.Layouts = {};
APP.Templates = {};
