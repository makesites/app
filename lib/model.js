
class Model {

	constructor( model, options ) {

		this.defaults = {
			autofetch: false,
			cache: false
		};

		// save options for later
		options = options || {};
		this.options = _.extend({}, this.defaults, options);

		this.initialize();
	}

	// initialization
	initialize(){
		// set data if given
		//if( !_.isNull( model ) && !_.isEmpty( model ) ) this.set( model );
		if( typeof model == "object" ) this.set( model );
		// restore cache
		if( this.options.cache ){
			var cache = this.cache();
			if( cache ) this.set( cache );
		}
		// auto-fetch if no models are passed
		if( this.options.autofetch && !_.isUndefined(this.url) ){
				this.fetch();
		}
	}

	// add is like set but only if not available
	add( obj ){
		var self = this;
		var data = {};
		_.each( obj, function( item, key ){
			if( _.isUndefined( self.get(key) ) ){
				data[key] = item;
			}
		});
		this.set( data );
	}

	// #63 reset model to its default values
	reset(){
		return this.clear().set(this.defaults);
	}

	// Use cache, if available
	cache(){
		// optionally create your own custom a cache mechanism...
		return ( Model.cache ) ? Model.cache() : false;
	}

	// Helper functions
	// - check if the app is online
	isOnline(){
		return ( !_.isUndefined( app ) ) ? app.state.online : true;
	}

	getValue (object, prop) {
		if (!(object && object[prop])) return null;
		return _.isFunction(object[prop]) ? object[prop]() : object[prop];
	}

	parse( data ){
		var self = this;
		setTimeout(function(){ self.trigger("fetch"); }, 200); // better way to trigger this after parse?
		// cache response
		if( this.options.cache ){
			this.cache( data );
		}
		return data;
	}

	// extract data (and possibly filter keys)
	output(){
		// in most cases it's a straight JSON output
		return this.toJSON();
	}

}
