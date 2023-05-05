
class Template extends Model {

	constructor( html, options ) {
		// fallback(s)
		options = options || (options={});
		html = html || "";
		//
		super(options);

		this.html = html;

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

		markup = markup.replace(/`/g, '\\`');
		var template = function( data ){

			const keys = Object.keys( data );
			const fn = new Function(...keys, 'return `' + markup + '`');

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
