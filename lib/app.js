
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

		// Namespace containers
		this.Models = {};
		this.Routers = {};
		this.Collections = {};
		this.Views = {};
		this.Layouts = {};
		this.Templates = {};

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
	}

	routes() {
		return this._routes;
	}

}



// Base Classes
APP.Model = Model;
APP.View = View;
APP.Controller = Controller;
APP.Collection = Collection;
APP.Layout = Layout;

export { APP };
