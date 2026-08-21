
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

	// Cache
	// localStorage-backed cache (see cache.js). Call with data to store it, or
	// with no argument to retrieve it. Configure via options.cacheOptions:
	// { cache_key, cache_exclude:[], cache_timestamp }.
	cache( data ){
		// no storage engine available, nothing to do
		if( typeof localStorage === "undefined" ) return false;
		var opts = ( this.options && this.options.cacheOptions ) || {};
		var name = opts.cache_key || this.name || "model";
		// SET
		if( data ){
			// namespace by id when available
			if( data.id ) name += "_" + data.id;
			// clone so we don't mutate the source object
			var payload = _.extend({}, data);
			// exclude configured keys
			var exclude = opts.cache_exclude || [];
			for( var i = 0; i < exclude.length; i++ ) delete payload[ exclude[i] ];
			var value = JSON.stringify( payload );
			// optionally base64-wrap with a timestamp
			if( opts.cache_timestamp ){
				value = btoa( value );
				value = JSON.stringify({ data: value, timestamp: Date.now() });
			}
			return store.set( name, value );
		}
		// GET
		if( this.get("id") ) name += "_" + this.get("id");
		var cached = store.get( name );
		if( !cached ) return false;
		cached = JSON.parse( cached );
		if( opts.cache_timestamp ) cached = JSON.parse( atob( cached.data ) );
		return cached;
	}

	// Sync
	// - proxy to the native fetch()-based sync (see sync.js)

	sync( method, model, options ){
		return sync( method, model, options );
	}

	// a model is considered "new" until it has been assigned an id
	isNew(){
		return !this.has("id");
	}

	// fetch the model from the server
	fetch( options ){
		options = options || {};
		var self = this;
		var success = options.success;
		options.success = function( resp ){
			var data = self.parse( resp, options );
			self.set( data, options );
			if( success ) success.call( options.context, self, resp, options );
			self.trigger("sync", self, resp, options);
		};
		return this.sync("read", this, options);
	}

	// save the model to the server (create or update based on isNew)
	save( attrs, options ){
		options = options || {};
		// optimistically set the attributes locally
		if( attrs ) this.set( attrs, options );
		var self = this;
		var success = options.success;
		options.attrs = options.attrs || this.toJSON();
		options.success = function( resp ){
			var data = self.parse( resp, options );
			if( data ) self.set( data, options );
			if( success ) success.call( options.context, self, resp, options );
			self.trigger("sync", self, resp, options);
		};
		var method = this.isNew() ? "create" : ( options.patch ? "patch" : "update" );
		return this.sync( method, this, options );
	}

	// delete the model from the server
	destroy( options ){
		options = options || {};
		var self = this;
		var success = options.success;
		var destroy = function(){
			self.trigger("destroy", self, self.collection, options);
		};
		options.success = function( resp ){
			if( options.wait ) destroy();
			if( success ) success.call( options.context, self, resp, options );
			if( !self.isNew() ) self.trigger("sync", self, resp, options);
		};
		// nothing persisted on the server yet
		if( this.isNew() ){
			if( !options.wait ) destroy();
			options.success();
			return false;
		}
		if( !options.wait ) destroy();
		return this.sync("delete", this, options);
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
