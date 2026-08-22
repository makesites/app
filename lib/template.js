
class Template extends Model {

	constructor( html, options ) {
		// fallback(s)
		options = options || (options={});
		html = html || "";
		// pass options as Model *options* (not as model attributes) so this.options
		// carries url/type/compiler. (Was `super(options)`, which mis-routed them
		// into attributes and left this.options.url undefined - the remote-template
		// url branch never fired.)
		super({}, options);

		this.html = html;

		this.cid = _.uniqueId("template");

		this.initialize();
	}

	initialize(){
		// fallback for options
		var html = this.html;

		if( !_.isEmpty(html) ){
			this.set( "default", this.compile( html ) );
			this.trigger("loaded");
		}
		//if( !_.isUndefined( options.url ) && !_.isEmpty( options.url ) ){
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
		// main function
		var template = function( data ){
			data = data || {};
			const keys = Object.keys( data );
			// HTML-escape string values before they are interpolated into the markup
			const values = keys.map(function( key ){
				var v = data[key];
				return ( typeof v === "string" ) ? escape( v ) : v;
			});
			const fn = new Function(...keys, 'return `' + cleanMarkup + '`');

			return fn(...values);
		};

		//template.bind( this );

		return template;
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
