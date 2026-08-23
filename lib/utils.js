/**
 * The framework's utility belt. A single shared instance is exported as `_` — the
 * same one every framework class uses — so code extending Model / View /
 * Collection has the same helpers available:
 *
 *   import { _ } from "@makesites/app";
 *   _.extend( target, patch );
 *   _.result( this, "url" );
 *
 * The name is a convention carried over from the Underscore.js days; the
 * dependency is long gone and these are all hand-written or native.
 */
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
	/**
	 * Shallow-merge the own-enumerable properties of each source onto the first
	 * argument and return it. Both `_.extend({}, a, b)` and the mutating
	 * `_.extend(target, patch)` forms work; falsy sources are skipped.
	 * @param {Object} destination
	 * @param {...Object} sources
	 * @returns {Object} destination
	 */
	extend( destination, ...sources ){
		destination = destination || {};
		// Object.assign copies the same own-enumerable keys the hand-rolled
		// for...in loop did, but in native code - measured ~1.35x faster, and this
		// is the most-called helper in the library.
		for( var i = 0; i < sources.length; i++ ){
			// keep the falsy-source skip: the previous loop ignored "" / 0 / false
			// as well as null, and callers rely on `_.extend({}, maybeUndefined)`
			if( !sources[i] ) continue;
			Object.assign( destination, sources[i] );
		}
		return destination;
	}

	/**
	 * A random RFC-4122 v4 identifier.
	 * @returns {string}
	 */
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

	// Permanently bind the named methods to `context`.
	//
	// The hand-rolled wrapper this replaces called `f.apply(context)` with NO
	// arguments, so every bound method silently lost its parameters -
	// `_.bindAll(obj, "greet"); obj.greet("Ada", "!")` returned "hi undefinedundefined".
	// Function.prototype.bind forwards them, and is faster besides.
	/**
	 * Permanently bind the named methods to `context`, so they can be passed as
	 * detached callbacks.
	 * @param {Object} context
	 * @param {...string} methods
	 * @returns {Object} context
	 */
	bindAll( context, ...methods ){
		for( var i = 0; i < methods.length; i++ ){
			var name = methods[i];
			if( typeof context[name] === "function" ) context[name] = context[name].bind( context );
		}
		return context;
	}

	// Source: https://locutus.io/php/var/empty/
	/**
	 * PHP-style emptiness: `undefined`, `null`, `false`, `0`, `""`, `"0"` and an
	 * object with no own keys are all empty.
	 * @param {*} mixedVar
	 * @returns {boolean}
	 */
	isEmpty( mixedVar ){
		// the PHP-style empty values, compared inline instead of scanned out of an
		// array that was rebuilt on every call (~1.6x faster). Semantics unchanged:
		// 0, false and "0" are still "empty".
		if( mixedVar === undefined || mixedVar === null || mixedVar === false ||
			mixedVar === 0 || mixedVar === '' || mixedVar === '0' ) return true;
		if( typeof mixedVar !== 'object' ) return false;
		// early-return on the first own key. Deliberately NOT Object.keys(x).length:
		// that allocates an array to answer a question the first iteration settles.
		for( const key in mixedVar ){
			if( Object.prototype.hasOwnProperty.call( mixedVar, key ) ) return false;
		}
		return true;
	}

	isString( v ){
		return (typeof v == "string");
	}

	/**
	 * The element siblings of a node (excluding itself and text nodes).
	 * @param {Element} elem
	 * @returns {Element[]}
	 */
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

	// A prefixed, monotonically-increasing unique id (used for cids).
	// (The previous time-based implementation collided for objects created in the
	// same millisecond, which broke cid uniqueness - and thus the collection
	// _byId index and per-view delegateEvents namespaces.)
	/**
	 * A process-unique id, optionally prefixed — used for `cid`s.
	 * @param {string} [prefix]
	 * @returns {string}
	 */
	uniqueId( prefix ){
		this._idCounter = ( this._idCounter || 0 ) + 1;
		return ( prefix ? prefix + "-" : "" ) + this._idCounter;
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
	/**
	 * Resolve a property that may be a value, a getter or a method: walks `path`
	 * on `obj`, invoking any function it finds with its parent as context.
	 * @param {Object} obj
	 * @param {(string|string[])} path
	 * @param {*} [fallback]
	 * @returns {*}
	 */
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

	// Iterate over a list or an object's own values.
	//
	// Deliberately left as explicit loops. The "obvious" vanilla rewrite
	// (`Object.entries(obj).forEach(...)`) measured **4.3x SLOWER** here, because
	// it allocates an array of [key, value] pairs to walk an object we can walk
	// directly. Native is not automatically faster - it was measured.
	/**
	 * Iterate an array's items or an object's own values.
	 * @param {(Array|Object)} obj
	 * @param {(value: *, key: (number|string), obj: *) => void} fn
	 * @param {Object} [context]
	 * @returns {(Array|Object)} obj
	 */
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

	// Can `obj[name] = value` succeed? False when the name resolves to an
	// accessor with no setter anywhere on the prototype chain - assigning to one
	// throws in strict mode (all ES modules are strict), which is what broke
	// subclass getters before the resolve-merge lifecycle of commit 27. Use this
	// where a public name genuinely has to be assigned rather than resolved.
	/**
	 * Can `obj[name] = value` succeed? False when the name resolves to an accessor
	 * with no setter — assigning to one throws in strict mode.
	 * @param {Object} obj
	 * @param {string} name
	 * @returns {boolean}
	 */
	assignable( obj, name ){
		var target = obj;
		while( target ){
			var descriptor = Object.getOwnPropertyDescriptor( target, name );
			if( descriptor ) return !!( descriptor.writable || descriptor.set );
			target = Object.getPrototypeOf( target );
		}
		// not declared anywhere - a plain assignment creates it
		return true;
	}

	// shallow value equality: strict for primitives, JSON for plain objects/arrays
	// (guarded, so circular structures compare unequal rather than throwing)
	/**
	 * Value equality: strict for primitives, structural (via JSON) for plain
	 * objects and arrays. Circular structures compare unequal rather than throwing.
	 * @param {*} a
	 * @param {*} b
	 * @returns {boolean}
	 */
	isEqual( a, b ){
		if( a === b ) return true;
		if( a === null || b === null || typeof a !== "object" || typeof b !== "object" ) return false;
		try { return JSON.stringify(a) === JSON.stringify(b); } catch(e){ return false; }
	}

	// copy the properties of `obj` onto this utils instance (used to register a
	// template compiler, e.g. Handlebars)
	/**
	 * Copy properties onto this utils instance — the extension point for
	 * registering a template compiler, e.g. `_.mixin({ template: Handlebars.compile })`.
	 * @param {Object} obj
	 * @returns {this}
	 */
	mixin( obj ){
		for( var key in obj ) this[key] = obj[key];
		return this;
	}

}
