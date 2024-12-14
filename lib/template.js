
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
		_.bindAll(this, 'fetch', 'parse');
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

		const cleanMarkup = this._sanitize( markup );

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

	fetch(){
		// this can be replaced with a backbone method...
		$.get(this.url, this.parse);
	}

	parse( data ){
		var self = this;
		var scripts;
		try{
			scripts = $(data).filter("script");
		} catch( e){
			// can't parse this - probly not html...
			scripts = [];
		}
		// check if there are script tags
		if( !scripts.length ){
			// save everything in the default attr
			this.set( "default", self.compile( data ) );
		} else {
			// loop through the scripts
			scripts.each(function(){
				// filter only scripts defined as template
				var el = $(this);
				if(el.attr("type").indexOf("template") >= 0){
					// convention: the id sets the key for the template
					self.set( el.attr("id"), self.compile( el.html() ) );
				}
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

		const text => text.toString().replace(/[&<>\(\)]/g, tag =>
		replaceTags[tag] || tag);

		return text;
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
