import { Model } from "./model.js";
import { _ } from "./utils.js";

// Reserved words that cannot be used as a function parameter name, so they can
// never be exposed as a template variable (the payload is still reachable as
// `data` / `obj`).
const RESERVED_WORDS = new Set([
	"break","case","catch","class","const","continue","debugger","default","delete",
	"do","else","enum","export","extends","false","finally","for","function","if",
	"import","in","instanceof","new","null","return","super","switch","this","throw",
	"true","try","typeof","var","void","while","with","yield","let","static",
	"implements","interface","package","private","protected","public","await","arguments","eval"
]);

class Template extends Model {

	/**
	 * @param {string} [html] - inline markup to compile
	 * @param {Object} [options] - { url, type, compiler }
	 */
	constructor( html, options ) {
		// fallback(s)
		options = options || {};
		html = html || "";
		// pass options as Model *options* (not as model attributes) so this.options
		// carries url/type/compiler. (Was `super(options)`, which mis-routed them
		// into attributes and left this.options.url undefined - the remote-template
		// url branch never fired.)
		super({}, options);

		this.html = html;

		this.cid = _.uniqueId("template");

		this._setupTemplate();
	}

	// Compile the inline markup and/or start the remote load.
	//
	// This used to live in initialize(), which ran TWICE: Model's constructor
	// calls initialize() and Template's constructor called it again. On the first
	// pass `this.html` was still undefined (it is assigned after super()), but
	// `this.options.url` was already set - so a remote template was fetched twice
	// and "loaded" fired twice. Keeping the work here leaves initialize() as what
	// it is everywhere else in the framework: the subclass hook, called once.
	_setupTemplate(){
		var html = this.html;

		if( !_.isEmpty(html) ){
			this.set( "default", this.compile( html ) );
			this.trigger("loaded");
		}
		if( this.options.url ){
			this.url = this.options.url;
			this.fetch();
		}
	}

	compile( markup ){

		// Pluggable compiler: when a `compiler` option is supplied (e.g.
		// Handlebars.compile, or a CSP-safe engine), delegate to it instead of the
		// built-in one. The built-in uses `new Function`, which requires the
		// 'unsafe-eval' CSP directive - inject a compiler to run under strict CSP.
		var compiler = this.options && this.options.compiler;
		if( typeof compiler === "function" ) return compiler( markup );

		// coerce to a string template (the markup itself is author-trusted)
		var cleanMarkup = _.isString( markup ) ? markup : String( markup == null ? "" : markup );
		// escape backticks so they don't terminate the template literal early
		cleanMarkup = cleanMarkup.replace(/`/g, '\\`');
		// escaper applied to interpolated *values* (mitigates HTML/script injection)
		var escape = this._sanitize();
		// compiled functions, keyed by the argument signature. The signature only
		// changes when the shape of the data changes, so in practice a template is
		// compiled once instead of on every single render.
		var compiled = Object.create( null );
		// main function
		var template = function( data ){
			data = data || {};
			// The whole payload is always available as `data` / `obj`, and `escape`
			// is the HTML escaper (top-level string values are escaped for you;
			// anything you reach through `data` is raw, so escape it yourself:
			// `${data.items.map(i => escape(i.title))}`).
			//
			// Only keys that are legal JavaScript identifiers can also be exposed
			// by name: `new Function(...)` builds a parameter list, so a key like
			// "0" (every key of an array - e.g. a Collection's toJSON()) or
			// "foo-bar" used to throw `SyntaxError: Unexpected number` at render
			// time, taking every collection-backed view down with it.
			const keys = [ "data", "obj", "escape" ];
			const values = [ data, data, escape ];
			Object.keys( data ).forEach(function( key ){
				if( !Template.isIdentifier( key ) || keys.indexOf( key ) > -1 ) return;
				keys.push( key );
				var value = data[key];
				// HTML-escape string values before they are interpolated
				values.push( ( typeof value === "string" ) ? escape( value ) : value );
			});

			const signature = keys.join(",");
			const fn = compiled[signature] ||
				( compiled[signature] = new Function(...keys, 'return `' + cleanMarkup + '`') );

			return fn(...values);
		};

		//template.bind( this );

		return template;
	}

	// Is `name` usable as a function parameter? (a valid identifier, and not a
	// reserved word - `new Function("class", ...)` is a SyntaxError)
	static isIdentifier( name ){
		return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test( name ) && !RESERVED_WORDS.has( name );
	}

	// fetch a remote template file natively (no jQuery $.get)
	async fetch(){
		try {
			const response = await fetch( this.url );
			const html = await response.text();
			this.parse( html );
		} catch( err ){
			console.error("Failed to load template:", this.url, err);
		}
	}

	parse( data ){
		var self = this;
		// natively parse the fetched HTML string into a queryable document
		var doc;
		try {
			doc = new DOMParser().parseFromString( data, "text/html" );
		} catch( e ){
			// can't parse this - probably not html...
			doc = null;
		}
		// look for template fragments: modern <template> or <script type="...template...">
		var fragments = doc ? doc.querySelectorAll('template, script[type*="template"]') : [];
		// check if there are any template fragments
		if( !fragments.length ){
			// save everything in the default attr
			this.set( "default", self.compile( data ) );
		} else {
			// loop through the fragments
			fragments.forEach(function( el ){
				// convention: the id sets the key for the template
				if( el.id ) self.set( el.id, self.compile( el.innerHTML ) );
			});
		}
		this.trigger("loaded");
		//return data;
	}

	// internal methods
	// returns a function that HTML-escapes a value; applied to interpolated data
	// (not to the markup itself) to prevent injection when set via innerHTML
	_sanitize() {
		const replaceTags = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;'
		};

		return function( text ){
			return String( text ).replace(/[&<>"']/g, tag => replaceTags[tag] || tag);
		};
	}

}

export { Template };
