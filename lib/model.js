
class Model extends Base {

	constructor( model, options={} ) {
		super( options );

		this.defaults = {
			autofetch: false,
			cache: false
		};

		this.attributes = {};

		// events
		// - hidden target
		this._e = new EventTarget();

		// save options for later
		options = options || {};
		this.options = _.extend({}, this.defaults, options);
		// set data if given
		//if( !_.isNull( model ) && !_.isEmpty( model ) ) this.set( model );
		if( typeof model == "object" ) this.set( model );

		this.cid = _.uniqueId("model");

		this.initialize();
	}

	// initialization
	initialize(){
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

	// Getter/Setter

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

	// Get the value of an attribute.
	get( attr ){
		return this.attributes[attr];
	}

	has( attr ){
		return this.get(attr) != null;
	}

	// Set a hash of model attributes on the object, firing `"change"`.
	// Based on Backbone.js Model.set
	set( key, val, options ){
		if (key == null) return this;

		// Handle both `"key", value` and `{key: value}` -style arguments.
		var attrs;
		if (typeof key === 'object') {
			attrs = key;
			options = val;
		} else {
			(attrs = {})[key] = val;
		}

		options = options || {};

		// Extract attributes and options.
		var silent = options.silent;

		// For each `set` attribute, update or delete the current value.
		for( var attr in attrs ){
			val = attrs[attr];
			this.attributes[attr] = val;
		}

		if (!silent)  this.trigger('change', this, options);

		return this;
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

	// Events

	on( name, cb ){

		// Listen for the event.
		this._e.addEventListener( name , cb, false);

	}

	trigger( name, ctx, options ){
		const e = new Event( name );

		// Dispatch the event.
		this._e.dispatchEvent( e, ctx, options );

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

	toJSON( options ){
		var obj = this.attributes;
		if (typeof obj !== 'object') return obj;
		return ( Array.isArray(obj) ) ? obj.slice() : _.extend({}, obj);
	}

	// extract data (and possibly filter keys)
	output(){
		// in most cases it's a straight JSON output
		return this.toJSON();
	}

}
