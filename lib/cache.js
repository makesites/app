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

export { store };
