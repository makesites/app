
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
		this.Controllers = {};
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
		// find controller
		var controller = false;
		// check URIs
		var path = window.location.pathname.split( '/' );
		// FIX: discart the first item if it's empty
		if ( path[0] === "" ) path.shift();
		//
		if( options.require ){
			// use require.js
			var controllerDefault = options.routePath +"default";
			if(typeof options.require == "string"){
				controller = options.require;
			} else {
				controller = options.routePath;
				controller += ( !_.isEmpty(path[0]) ) ? path[0] : "default";
			}
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
			// find a controller based on the path
			for(var i in path ){
				// discart the first item if it's empty
				if( path[i] === "") continue;
				controller = (path[i].charAt(0).toUpperCase() + path[i].slice(1));
				// stop if we've found a controller
				if(typeof(this.Controllers[controller]) == "function") break;
			}
			// call the controller or fallback to the default
			var route = (controller && this.Controllers[controller]) ? new this.Controllers[controller]( options ) : new Controller( options );
			// return controller so it's accessible through the app global
			return route;
		}


		// legacy
		this.Routers = this.Controllers;
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
