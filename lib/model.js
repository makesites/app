import { Base } from "./base.js";
import { store } from "./cache.js";
import { sync } from "./sync.js";
import { _ } from "./utils.js";

class Model extends Base {

	constructor( model, options={} ) {
		super( options );

		this.attributes = {};
		// change tracking
		this.changed = {};
		this._previousAttributes = {};
		// the attribute that holds the id (subclass may override via get idAttribute())
		if( typeof this.idAttribute === "undefined" ) this.idAttribute = "id";

		// framework option defaults (autofetch/cache) are kept internal, so a
		// subclass `defaults` means ATTRIBUTE defaults (Backbone semantics)
		options = options || {};
		this.options = _.extend({}, this._optionDefaults(), options);

		// seed attributes from the class `defaults` (getter/property); the passed
		// model overrides them
		var attrs = _.extend({}, _.result(this, 'defaults'), (model && typeof model === "object") ? model : {});
		this.set( attrs );

		this.cid = _.uniqueId("model");

		this.initialize();
	}

	// framework option defaults (internal - not the model's attribute `defaults`)
	_optionDefaults(){
		return { autofetch: false, cache: false };
	}

	// initialization
	initialize(){
		// restore cache
		if( this.options.cache ){
			var cache = this.cache();
			if( cache ) this.set( cache );
		}
		// auto-fetch when a url actually resolves. (Testing `this.url` no longer
		// works: since commit 29 every Model inherits a default url() method, so
		// the old guard was always true and autofetch threw
		// `A "url" property or function must be specified` from the constructor.)
		if( this.options.autofetch && _.result(this, 'url') ){
			this._autofetch();
		}
	}

	// autofetch is fire-and-forget: failures are reported through the "error"
	// event that sync() already fires, so the promise rejection is absorbed here
	// rather than surfacing as an unhandled rejection out of a constructor
	_autofetch(){
		var request = this.fetch();
		if( request && typeof request.catch === "function" ) request.catch(function(){});
		return request;
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

	// The model's payload.
	//
	// `data` is the library's convention for "the thing this object holds" -
	// Collection#data is its models, View#data is its source - so a Model exposes
	// its attributes under the same name. `attributes` remains as the
	// long-standing alias; both are the same object, so either can be read or
	// replaced.
	get data(){
		return this.attributes;
	}
	set data( value ){
		this.attributes = value || {};
	}

	/**
	 * Get the value of an attribute.
	 * @param {string} attr
	 * @returns {*}
	 */
	get( attr ){
		return this.attributes[attr];
	}

	has( attr ){
		return this.get(attr) != null;
	}

	/**
	 * Set attribute(s), firing `change:<attr>` then `change` for what actually
	 * changed. Accepts `(key, value)` or `({key: value})`.
	 * @param {(string|Object)} key - attribute name, or a {attr: value} hash
	 * @param {*} [val] - value (when key is a string)
	 * @param {{silent?: boolean}} [options]
	 * @returns {this}
	 */
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

		// run validation (only when options.validate); abort on failure
		if( !this._validate( attrs, options ) ) return false;

		var unset = options.unset;
		var silent = options.silent;
		var changes = [];
		var changing = this._changing;
		this._changing = true;

		// snapshot the previous state at the start of a (non-nested) set
		if( !changing ){
			this._previousAttributes = _.extend({}, this.attributes);
			this.changed = {};
		}
		var current = this.attributes;
		var prev = this._previousAttributes;

		// track the id
		if( this.idAttribute in attrs ) this.id = attrs[this.idAttribute];

		// compute changes vs. current, and cumulative changes vs. previous
		for( var attr in attrs ){
			val = attrs[attr];
			if( !_.isEqual( current[attr], val ) ) changes.push( attr );
			if( !_.isEqual( prev[attr], val ) ) this.changed[attr] = val;
			else delete this.changed[attr];
			if( unset ) delete current[attr]; else current[attr] = val;
		}

		// fire granular change:<attr> events, then a single change (once, even for
		// nested sets, via _pending)
		if( !silent ){
			if( changes.length ) this._pending = options;
			for( var i = 0; i < changes.length; i++ ){
				this.trigger( 'change:' + changes[i], this, current[changes[i]], options );
			}
		}

		if( changing ) return this;
		if( !silent ){
			while( this._pending ){
				options = this._pending;
				this._pending = false;
				this.trigger( 'change', this, options );
			}
		}
		this._pending = false;
		this._changing = false;
		return this;
	}

	// Validation
	// - override validate(attrs, options) to return an error to block set/save
	_validate( attrs, options ){
		if( !options.validate || !this.validate ) return true;
		attrs = _.extend({}, this.attributes, attrs);
		var error = this.validationError = this.validate( attrs, options ) || null;
		if( !error ) return true;
		this.trigger( 'invalid', this, error, _.extend({}, options, { validationError: error }) );
		return false;
	}

	// Change tracking

	hasChanged( attr ){
		if( attr == null ) return !_.isEmpty( this.changed );
		return this.changed ? ( attr in this.changed ) : false;
	}

	changedAttributes( diff ){
		if( !diff ) return this.hasChanged() ? _.extend({}, this.changed) : false;
		var old = this._previousAttributes;
		var changed = {}, has = false;
		for( var attr in diff ){
			if( _.isEqual( old[attr], diff[attr] ) ) continue;
			changed[attr] = diff[attr];
			has = true;
		}
		return has ? changed : false;
	}

	previous( attr ){
		if( attr == null || !this._previousAttributes ) return null;
		return this._previousAttributes[attr];
	}

	previousAttributes(){
		return _.extend({}, this._previousAttributes);
	}

	// #63 reset model to its (attribute) default values
	reset(){
		return this.clear().set( _.result(this, 'defaults') );
	}

	// remove all attributes from the model (firing "change")
	clear( options ){
		options = options || {};
		this.attributes = {};
		if( !options.silent ) this.trigger("change", this, options);
		return this;
	}

	// Cache
	// localStorage-backed cache (see cache.js). Call with data to store it, or
	// with no argument to retrieve it. Configure via options.cacheOptions:
	// { cache_key, cache_exclude:[], cache_timestamp }.
	cache( data ){
		// no usable storage engine (SSR, private mode, blocked site data)
		if( !store.available() ) return false;
		var opts = ( this.options && this.options.cacheOptions ) || {};
		var name = opts.cache_key || this.name || "model";
		// SET
		if( data ){
			// namespace by id when available
			if( data[this.idAttribute] ) name += "_" + data[this.idAttribute];
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
		if( this.get(this.idAttribute) ) name += "_" + this.get(this.idAttribute);
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

	// Default URL: `urlRoot` (or the owning collection's url) + "/" + id.
	// Override with a `url` string/getter, or a `urlRoot` string/getter.
	url(){
		var base = _.result( this, 'urlRoot' ) || ( this.collection && _.result( this.collection, 'url' ) ) || null;
		if( !base ) return null;
		if( this.isNew() ) return base;
		return base.replace(/\/$/, "") + "/" + encodeURIComponent( this.get( this.idAttribute ) );
	}

	// a model is considered "new" until it has been assigned an id
	isNew(){
		return !this.has( this.idAttribute );
	}

	/**
	 * Fetch the model from the server (GET) and apply the response.
	 * @param {SyncOptions} [options]
	 * @returns {Promise<*>}
	 */
	fetch( options ){
		options = options || {};
		var self = this;
		var success = options.success;
		options.success = function( resp ){
			var data = self.parse( resp, options );
			self.set( data, options );
			if( success ) success.call( options.context, self, resp, options );
			self.trigger("sync", self, resp, options);
			// the response is applied - emit "fetch" now, synchronously
			self.trigger("fetch", self, resp, options);
		};
		return this.sync("read", this, options);
	}

	/**
	 * Save the model to the server (POST when new, else PUT/PATCH).
	 * @param {Object} [attrs] - attributes to set before saving
	 * @param {SyncOptions} [options]
	 * @returns {Promise<*>}
	 */
	save( attrs, options ){
		options = options || {};
		// validate by default on save
		if( options.validate === undefined ) options.validate = true;
		// optimistically set the attributes locally (abort if invalid)
		if( attrs ){
			if( !this.set( attrs, options ) ) return false;
		} else if( !this._validate({}, options) ){
			return false;
		}
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

	// Events are inherited from Base (on/once/off/trigger/bind).

	// Helper functions
	// - check if the app is online
	// `app` is a global published by the APP facade; referencing it directly
	// threw a ReferenceError whenever no app had been instantiated (or outside a
	// browser), because `_.isUndefined(app)` still evaluates `app`. Only `typeof`
	// is safe on an undeclared identifier.
	isOnline(){
		return ( typeof app !== "undefined" && app && app.state ) ? app.state.online : true;
	}

	getValue (object, prop) {
		if (!(object && object[prop])) return null;
		return _.isFunction(object[prop]) ? object[prop]() : object[prop];
	}

	// Transform a server response before it is applied.
	//
	// This used to also `setTimeout(() => trigger("fetch"), 200)` - a side effect,
	// on a timer, inside a pure transform. It fired 200ms after the data had
	// already been applied (so listeners raced it), and it fired on save() too,
	// which is not a fetch. "fetch" is now emitted by fetch() itself, once the
	// response has been set.
	parse( data ){
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

export { Model };
