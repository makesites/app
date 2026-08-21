
class Template extends Model {

	constructor( html, options ) {
		// fallback(s)
		options = options || (options={});
		html = html || "";
		//
		super(options);

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

		var cleanMarkup = this._sanitize( markup );

		// escape single quotes so they don't escape the next function prematurely
		cleanMarkup = cleanMarkup.replace(/`/g, '\\`');
		// main function
		var template = function( data ){

			const keys = Object.keys( data );
			const fn = new Function(...keys, 'return `' + cleanMarkup + '`');

			return fn(...keys.map(key => data[key]));
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
	_sanitize( html ) {
		// prerequisites
		if( !_.isString(html) ) return false;
		// variables
		const replaceTags = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'(': '%28',
			')': '%29'
		};

		const output = text => text.toString().replace(/[&<>\(\)]/g, tag =>
		replaceTags[tag] || tag);

		return output;
	}

	/*
	Fallbacks
	} else if( url ) {
		// fallback to the underscore template
		$.get(url, function( html ){
			self.template = _.template( html );
			if( self.options.autoRender ) self.render();
		});
	} else {
		this.template = _.template( html );
		if( self.options.autoRender ) this.render();
	}
	*/

}
