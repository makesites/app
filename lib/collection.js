
class Collection extends Base {

	constructor( models, options={} ) {
		super( options );

		// defaults
		this.defaults = {
			_synced : false,
			autofetch: false,
			cache: false
		};

		// the "item" of the collection can be defined on instantiation or default to the base Model
		this.model = options.model || Model;
		// the internal data array + the id/cid index
		this._reset();

		// merge options
		options = options || {};
		this.options = _.extend( {}, this.defaults, options );
		// optional comparator (a subclass may also define get comparator())
		if( options.comparator !== undefined ) this._comparator = options.comparator;

		this.cid = _.uniqueId("collection");

		this.initialize( models, options );
		// populate from the passed models (silently, at construction)
		if( models ) this.reset( models, { silent: true } );
	}

	// (re)initialise the internal store: the data array + the id/cid index.
	// The index is a null-prototype object so that ids colliding with
	// Object.prototype members ("constructor", "toString", ...) can't resolve to
	// an inherited value instead of a model.
	_reset(){
		this.data = [];
		this._byId = Object.create( null );
	}

	// initialization hook (override freely)
	initialize( models, options ){
		// restore cache
		if( this.options.cache ){
			var cache = this.cache();
			if( cache ) this.add( cache );
		}
		// auto-fetch if no models are passed (and a url actually resolves)
		if( this.options.autofetch && _.isEmpty(models) && _.result(this, 'url') ){
			this._autofetch();
		}
	}

	// see Model#_autofetch - fire-and-forget, failures surface as "error" events
	_autofetch(){
		var request = this.fetch();
		if( request && typeof request.catch === "function" ) request.catch(function(){});
		return request;
	}
/*
	render(){

	}
*/
	update(){

	}

	/**
	 * Add one or many models/objects (deduped by id via set()). Fires "add".
	 * @param {(Object|Model|Array)} models
	 * @returns {(Model|Array)}
	 */
	add( models, options ){
		return this.set( models, _.extend({ merge: false }, options, { add: true, remove: false }) );
	}

	/**
	 * The "smart" update: add new models, merge existing ones (matched by id) and
	 * remove any not present in `models`. Options { add, remove, merge, sort,
	 * silent } (all default true except silent). Fires add / remove / sort / update.
	 * @param {(Object|Model|Array)} models
	 * @returns {(Model|Array)}
	 */
	set( models, options ){
		if( models == null ) return this;
		options = _.extend({ add: true, remove: true, merge: true }, options );
		var singular = !Array.isArray( models );
		var list = singular ? [ models ] : models.slice();

		var toAdd = [], keep = {};

		for( var i = 0; i < list.length; i++ ){
			var item = list[i];
			var id = this._idOf( item );
			// match an existing member by cid (same instance) or by id
			var existing = ( item && item.cid && this._byId[ item.cid ] ) || ( ( id != null ) ? this._byId[ id ] : null );
			if( existing ){
				// merge the incoming attributes into the existing model
				if( options.merge && item !== existing ){
					existing.set( item.attributes ? item.attributes : item, options );
				}
				keep[ existing.cid ] = true;
			} else if( options.add ){
				var model = this._prepareModel( item, options );
				// index the new model straight away so a duplicate later in the
				// SAME batch matches it (the full _addReference runs after the
				// removal pass, which would otherwise be too late to dedupe)
				this._index( model );
				toAdd.push( model );
				keep[ model.cid ] = true;
			}
		}

		// removals: existing models not present in the incoming set
		var removed = [];
		if( options.remove ){
			for( var j = this.data.length - 1; j >= 0; j-- ){
				var m = this.data[j];
				if( !keep[ m.cid ] ){
					this.data.splice( j, 1 );
					this._removeReference( m );
					removed.push( m );
				}
			}
		}

		// additions
		for( var k = 0; k < toAdd.length; k++ ){
			this.data.push( toAdd[k] );
			this._addReference( toAdd[k] );
		}

		// keep sorted when a comparator is set and models were added
		var sorted = false;
		if( ( this.comparator || this._comparator ) && toAdd.length && options.sort !== false ){
			this.sort({ silent: true });
			sorted = true;
		}

		// events
		if( !options.silent ){
			for( var a = 0; a < toAdd.length; a++ ) this.trigger( "add", toAdd[a], this, options );
			for( var r = 0; r < removed.length; r++ ) this.trigger( "remove", removed[r], this, options );
			if( sorted ) this.trigger( "sort", this, options );
			if( toAdd.length || removed.length ) this.trigger( "update", this, options );
		}

		var firstId = this._idOf( list[0] );
		return singular ? ( toAdd[0] || ( firstId != null ? this._byId[ firstId ] : null ) ) : this.data;
	}

	// resolve the id of a model instance or a plain attributes object
	_idOf( item ){
		if( item == null ) return undefined;
		if( item.cid && item.get ) return item.get( item.idAttribute );
		var idAttr = ( this.model && this.model.prototype && this.model.prototype.idAttribute ) || "id";
		return item[ idAttr ];
	}

	// wrap plain attributes in this.model (or return an existing model)
	_prepareModel( attrs, options ){
		if( attrs && attrs.cid && attrs.get ) return attrs;
		return new this.model( attrs, options );
	}

	/**
	 * Sort by the comparator (function(model)->key, function(a,b)->number, or an
	 * attribute-name string). Fires "sort".
	 * @returns {this}
	 */
	sort( options ){
		var comparator = this.comparator || this._comparator;
		if( !comparator ) return this;
		options = options || {};
		var self = this;
		if( typeof comparator === "string" ){
			this.data.sort(function( a, b ){
				var av = a.get( comparator ), bv = b.get( comparator );
				return ( av < bv ) ? -1 : ( av > bv ) ? 1 : 0;
			});
		} else if( comparator.length === 1 ){
			this.data.sort(function( a, b ){
				var av = comparator.call( self, a ), bv = comparator.call( self, b );
				return ( av < bv ) ? -1 : ( av > bv ) ? 1 : 0;
			});
		} else {
			this.data.sort( comparator.bind( this ) );
		}
		if( !options.silent ) this.trigger( "sort", this, options );
		return this;
	}

	/**
	 * Remove a model - accepts a model, an id, or a cid. Fires "remove".
	 * @param {(Model|string|number|Array)} target
	 * @returns {?Model}
	 */
	remove( target, options ){
		options = options || {};
		if( Array.isArray( target ) ){
			var self = this;
			return target.map(function( t ){ return self.remove( t, options ); });
		}
		var model = ( target && target.cid ) ? target : this.get( target );
		if( !model ) return null;
		var index = this.data.indexOf( model );
		if( index > -1 ) this.data.splice( index, 1 );
		this._removeReference( model );
		if( !options.silent ) this.trigger( "remove", model, this, options );
		return model;
	}

	/**
	 * Replace all models at once, firing a single "reset".
	 * @param {Array} [models]
	 * @returns {this}
	 */
	reset( models, options ){
		options = options || {};
		for( var i = 0; i < this.data.length; i++ ) this._removeReference( this.data[i] );
		options.previousModels = this.data;
		this._reset();
		if( models ) this.add( models, _.extend({}, options, { silent: true }) );
		this.options._synced = true;
		if( !options.silent ) this.trigger( "reset", this, options );
		return this;
	}

	// index a model by cid and by id (both point at the same model)
	_index( model ){
		if( !model ) return;
		if( model.cid ) this._byId[ model.cid ] = model;
		var id = model.get ? model.get( model.idAttribute || "id" ) : null;
		if( id != null ) this._byId[ id ] = model;
	}

	// maintain the id/cid index + a back-reference, and forward the model's events
	_addReference( model ){
		if( !model ) return;
		this._index( model );
		if( !model.collection ) model.collection = this;
		if( model.on ) model.on( "all", this._onModelEvent, this );
	}
	_removeReference( model ){
		if( !model ) return;
		if( model.cid ) delete this._byId[ model.cid ];
		var id = model.get ? model.get( model.idAttribute || "id" ) : null;
		if( id != null ) delete this._byId[ id ];
		if( model.collection === this ) delete model.collection;
		if( model.off ) model.off( "all", this._onModelEvent, this );
	}

	// forward a member model's events onto the collection; drop destroyed members
	// and keep the id index fresh when a member's id changes
	_onModelEvent(){
		var args = Array.prototype.slice.call( arguments );
		var event = args[0], model = args[1];
		if( event === "destroy" ) this.remove( model );
		if( model && event === ( "change:" + model.idAttribute ) ){
			var prev = model.previous( model.idAttribute );
			if( prev != null ) delete this._byId[ prev ];
			if( model.id != null ) this._byId[ model.id ] = model;
		}
		this.trigger.apply( this, args );
	}

	/**
	 * Save every model in the collection. Resolves when all have saved.
	 * @param {SyncOptions} [options]
	 * @returns {Promise<Array>}
	 */
	save( options ){
		options = options || {};
		var promises = this.data.map(function( model ){ return model.save( null, options ); });
		return Promise.all( promises );
	}

	// Sync
	// - proxy to the native fetch()-based sync (see sync.js)

	sync( method, model, options ){
		return sync( method, model, options );
	}

	// fetch the collection from the server
	fetch( options ){
		options = options || {};
		var self = this;
		var success = options.success;
		options.success = function( resp ){
			var data = self.parse( resp, options );
			// merge the server response (or replace, with options.reset)
			self[ options.reset ? "reset" : "set" ]( data, options );
			self.options._synced = true;
			if( success ) success.call( options.context, self, resp, options );
			self.trigger("sync", self, resp, options);
		};
		return this.sync("read", this, options);
	}

	/**
	 * Retrieve a single model by array index, id, name, or cid.
	 * @param {(number|string)} key
	 * @returns {?Model}
	 */
	get( key ) {
		if( key == null ) return null;
		// a model instance -> resolve it through the index
		if( key.cid ) return this._byId[ key.cid ] || null;
		// id or cid -> O(1) via the index. This MUST be tried before the integer
		// branch below: ids are numeric far more often than not, and the old
		// order made `get(9)` return the model at index 9 rather than id 9 - so
		// the index was unreachable for the common `{ id: 1 }` convention.
		if( this._byId[ key ] != null ) return this._byId[ key ];
		// integer -> array index (legacy fallback; `at()` is the explicit form).
		// Normalised to null when out of range, so get() honours its ?Model
		// contract instead of mixing null and undefined.
		if( Number.isInteger( key ) ) return this.data[ key ] || null;
		// name -> linear scan
		for ( var i = 0; i < this.data.length; i++ ){
			if( key === this.data[i].get('name') ) return this.data[i];
		}
		return null;
	}

	// the model at a specific index
	at( index ){
		return this.data[ index ];
	}

	// Array methods
	// --------------
	// Proxy the modern native Array.prototype methods to the internal `data`
	// array. Replaces the old Underscore.js iteration mixins - the V8 engine
	// is heavily optimised for these native methods. Legacy Underscore aliases
	// (each/collect/all/any/contains) are kept so existing app code won't break.

	forEach( callback, thisArg ){ return this.data.forEach( callback, thisArg ); }
	each( callback, thisArg ){ return this.forEach( callback, thisArg ); }

	map( callback, thisArg ){ return this.data.map( callback, thisArg ); }
	collect( callback, thisArg ){ return this.map( callback, thisArg ); }

	reduce( callback, initial ){
		return ( arguments.length > 1 ) ? this.data.reduce( callback, initial ) : this.data.reduce( callback );
	}
	reduceRight( callback, initial ){
		return ( arguments.length > 1 ) ? this.data.reduceRight( callback, initial ) : this.data.reduceRight( callback );
	}

	find( callback, thisArg ){ return this.data.find( callback, thisArg ); }
	findIndex( callback, thisArg ){ return this.data.findIndex( callback, thisArg ); }
	filter( callback, thisArg ){ return this.data.filter( callback, thisArg ); }
	reject( callback, thisArg ){ return this.data.filter( function( model, i, arr ){ return !callback.call( thisArg, model, i, arr ); }); }

	every( callback, thisArg ){ return this.data.every( callback, thisArg ); }
	all( callback, thisArg ){ return this.every( callback, thisArg ); }

	some( callback, thisArg ){ return this.data.some( callback, thisArg ); }
	any( callback, thisArg ){ return this.some( callback, thisArg ); }

	includes( model, fromIndex ){ return this.data.includes( model, fromIndex ); }
	contains( model, fromIndex ){ return this.includes( model, fromIndex ); }

	indexOf( model, fromIndex ){ return this.data.indexOf( model, fromIndex ); }
	lastIndexOf( model, fromIndex ){ return this.data.lastIndexOf( model, fromIndex ); }

	slice( start, end ){ return this.data.slice( start, end ); }
	toArray(){ return this.slice(); }

	// Collection specific helpers (native)

	// pluck an attribute from every model in the collection
	pluck( attr ){
		return this.map(function( model ){ return model.get( attr ); });
	}

	// return the models with matching attributes
	where( attrs, first ){
		if( !attrs || Object.keys( attrs ).length === 0 ) return first ? void 0 : [];
		var matcher = function( model ){
			for( var key in attrs ){
				if( attrs[key] !== model.get( key ) ) return false;
			}
			return true;
		};
		return first ? this.find( matcher ) : this.filter( matcher );
	}

	// return the first model with matching attributes
	findWhere( attrs ){
		return this.where( attrs, true );
	}

	isEmpty(){
		return this.length === 0;
	}

	// Underscore-style aggregation helpers (native over this.data)
	// ------------------------------------------------------------
	// The grouping/aggregating helpers Backbone inherited from Underscore, kept
	// as thin native implementations. An "iteratee" is either an attribute-name
	// string (resolved via model.get) or a function called with the model.

	// normalise an iteratee to a function(model) -> value
	_iteratee( iter ){
		if( iter == null ) return function( model ){ return model; };
		if( typeof iter === "string" ) return function( model ){ return model.get( iter ); };
		return iter;
	}

	// shared bucketing engine: apply `behavior(result, key, model)` per model
	_group( iter, behavior ){
		var fn = this._iteratee( iter ), result = {};
		this.forEach(function( model ){
			behavior( result, fn.call( this, model ), model );
		}, this );
		return result;
	}

	// group the models into arrays keyed by the iteratee result
	groupBy( iter ){
		return this._group( iter, function( result, key, model ){
			( result[ key ] || ( result[ key ] = [] ) ).push( model );
		});
	}

	// count the models keyed by the iteratee result
	countBy( iter ){
		return this._group( iter, function( result, key ){
			result[ key ] = ( result[ key ] || 0 ) + 1;
		});
	}

	// a stably-sorted *copy* of the models, ascending by the iteratee result.
	// Non-destructive — unlike sort(), which reorders this.data in place.
	sortBy( iter ){
		var fn = this._iteratee( iter ), self = this;
		return this.slice()
			.map(function( model, index ){ return { model: model, key: fn.call( self, model ), index: index }; })
			.sort(function( a, b ){
				if( a.key !== b.key ) return ( a.key < b.key ) ? -1 : 1;
				return a.index - b.index;   // keep equal keys in original order
			})
			.map(function( entry ){ return entry.model; });
	}

	// call a named method on every model, returning the array of results
	invoke( method ){
		var args = Array.prototype.slice.call( arguments, 1 );
		return this.map(function( model ){
			var fn = ( model == null ) ? null : model[ method ];
			return fn ? fn.apply( model, args ) : undefined;
		});
	}

	// split the models into [ pass, fail ] by a predicate(model)
	partition( predicate ){
		var pass = [], fail = [];
		this.forEach(function( model ){ ( predicate( model ) ? pass : fail ).push( model ); });
		return [ pass, fail ];
	}

	// the model with the smallest iteratee result (undefined when empty)
	min( iter ){
		var fn = this._iteratee( iter ), result, best = Infinity;
		this.forEach(function( model ){
			var value = fn.call( this, model );
			if( value < best ){ best = value; result = model; }
		}, this );
		return result;
	}

	// the model with the largest iteratee result (undefined when empty)
	max( iter ){
		var fn = this._iteratee( iter ), result, best = -Infinity;
		this.forEach(function( model ){
			var value = fn.call( this, model );
			if( value > best ){ best = value; result = model; }
		}, this );
		return result;
	}

	// a random model, or an array of `n` distinct random models (Fisher–Yates)
	sample( n ){
		if( n == null ) return this.data[ Math.floor( Math.random() * this.length ) ];
		var copy = this.slice(), count = Math.max( 0, Math.min( n, copy.length ) );
		for( var i = 0; i < count; i++ ){
			var rand = i + Math.floor( Math.random() * ( copy.length - i ) );
			var tmp = copy[i]; copy[i] = copy[ rand ]; copy[ rand ] = tmp;
		}
		return copy.slice( 0, count );
	}

	// getters (native paradigm favours these over size()/length())
	get length(){
		return this.data.length;
	}

	// alias mirroring the classic Backbone `models` array
	get models(){
		return this.data;
	}

	get size(){
		return this.length;
	}

	// Cache
	// stores/retrieves the collection as a list of model ids in localStorage,
	// resolving each id back to its individually-cached model on read.
	cache( data ){
		if( typeof localStorage === "undefined" ) return false;
		var opts = ( this.options && this.options.cacheOptions ) || {};
		var name = opts.cache_key || this.name || this.cid;
		// SET: store just the ids of the models
		if( data ){
			var ids = data.map(function( item ){ return item.id || item._id; });
			return store.set( name, JSON.stringify( ids ) );
		}
		// GET: resolve each cached id back to its cached model data
		var stored = store.get( name );
		if( !stored ) return false;
		var list = JSON.parse( stored );
		// determine the model cache-name convention
		var ModelClass = this.model;
		var sample = new ModelClass();
		var mopts = ( sample.options && sample.options.cacheOptions ) || {};
		var mname = mopts.cache_key || sample.name || "model";
		return list.map(function( id ){
			var mdata = store.get( mname + "_" + id );
			return mdata ? JSON.parse( mdata ) : {};
		});
	}

	parse( data ){
		var self = this;
		setTimeout(function(){ self.trigger("fetch"); }, 200); // better way to trigger this after parse?
		// cache results
		if( this.options.cache ){
			this.cache( data );
		}
		return data;
	}

	// serialise the collection to a plain array of the models' data
	toJSON( options ){
		return this.data.map(function( model ){
			return ( model && typeof model.toJSON === "function" ) ? model.toJSON( options ) : model;
		});
	}

	// extract data (and possibly filter keys)
	output(){
		// in most cases it's a straight JSON output
		return this.toJSON();
	}

	isNew() {
		return this.options._synced === false;
	}

	// - check if the app is online
	// see Model#isOnline: only `typeof` is safe on the (possibly undeclared)
	// `app` global that the APP facade publishes
	isOnline(){
		return ( typeof app !== "undefined" && app && app.state ) ? app.state.online : true;
	}

}
