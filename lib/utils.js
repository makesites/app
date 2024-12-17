// utilities
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
			_.mixin({
				template : Handlebars.compile
			});
		}

	}

	// Common.js extend method: https://github.com/commons/common.js
	extend(){
		var objects = Array.prototype.slice.call( arguments ); // to array?
		var destination = {};
		for( var obj in objects ){
			var source = objects[obj];
			for (var property in source){
				if (source[property] && source[property].constructor && source[property].constructor === Object) {
					destination[property] = destination[property] || {};
					destination[property] = _.extend.caller(destination[property], source[property]);
				} else {
					destination[property] = source[property];
				}
			}
		}
		return destination;
	}

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

	// Source: https://www.30secondsofcode.org/js/s/bind-all/
	bindAll( context, ...methods ){
		methods.forEach(function( fn ){
			let f = context[fn];
			context[fn] = function() {
				return f.apply(context);
			};
		});
	}

	// Source: https://locutus.io/php/var/empty/
	isEmpty( mixedVar ){
		let undef;
		let key;
		let i;
		let len;
		const emptyValues = [undef, null, false, 0, '', '0'];
		for (i = 0, len = emptyValues.length; i < len; i++) {
			if (mixedVar === emptyValues[i]) {
				return true;
			}
		}
		if (typeof mixedVar === 'object') {
			for (key in mixedVar) {
				if (mixedVar.hasOwnProperty(key)) {
					return false;
				}
			}
			return true;
		}
		return false;
	}

	isString( v ){
		return (typeof v == "string");
	}

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

	// Based on uniqueCode.js (with a prefix)
	// Source: https://gist.github.com/tracend/8203090
	uniqueId( prefix ){
		// fallback
		prefix = prefix+"-" || "";
		// variables
		var characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
		var ticks = (new Date()).getTime().toString();
		var code = "";
		for (var i = 0; i < characters.length; i += 2) {
			if ((i + 2) <= ticks.length) {
				var number = parseInt(ticks.substr(i, 2));
				if (number > characters.length - 1) {
					var one = number.toString().substr(0, 1);
					var two = number.toString().substr(1, 1);
					code += characters[parseInt(one)];
					code += characters[parseInt(two)];
				} else {
					code += characters[number];
				}
			}
		}
		return prefix + code;
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

}
