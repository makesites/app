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
