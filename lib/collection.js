
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

		this.cid = _.uniqueId("collection");

		this.initialize( models, options );
		// populate from the passed models (silently, at construction)
		if( models ) this.reset( models, { silent: true } );
	}

	// (re)initialise the internal store: the data array + the id/cid index
	_reset(){
		this.data = [];
		this._byId = {};
	}

	// initialization hook (override freely)
	initialize( models, options ){
		// restore cache
		if( this.options.cache ){
			var cache = this.cache();
			if( cache ) this.add( cache );
		}
		// auto-fetch if no models are passed
		if( this.options.autofetch && _.isEmpty(models) && this.url ){
			this.fetch();
		}
	}
/*
	render(){

	}
*/
	update(){

	}

	/**
	 * Add one model/object, or an array of them. Plain objects are wrapped in
	 * `this.model`.
	 * @param {(Object|Model|Array)} data
	 * @returns {(Model|void)} the added model (single add)
	 */
	add( data, options ) {
		options = options || {};
		// support adding multiple models at once
		if( Array.isArray( data ) ){
			var self = this;
			return data.forEach(function( item ){ self.add( item, options ); });
		}
		// check if the supplied data is already a model
		var model = ( data && data.cid && String(data.cid).includes("model") ) ? data : new this.model( data );
		// add at the end of the models array + index it
		this.data.push( model );
		this._addReference( model );
		if( !options.silent ) this.trigger( "add", model, this, options );
		return model;
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

	// maintain the id/cid index + a back-reference from the model
	_addReference( model ){
		if( !model ) return;
		if( model.cid ) this._byId[ model.cid ] = model;
		var id = model.get ? model.get( model.idAttribute || "id" ) : null;
		if( id != null ) this._byId[ id ] = model;
		if( !model.collection ) model.collection = this;
	}
	_removeReference( model ){
		if( !model ) return;
		if( model.cid ) delete this._byId[ model.cid ];
		var id = model.get ? model.get( model.idAttribute || "id" ) : null;
		if( id != null ) delete this._byId[ id ];
		if( model.collection === this ) delete model.collection;
	}

	// to add multiple models
	save(models, options){
		// merge models
		_.extend(this.models, models);
		// callback is run once, after all models have saved.
		if( options.success ){
			var callback = _.after(this.models.length, options.success);
			_.each( this.models, function( model ){
				model.save(null, {success: callback});
			});
		}
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
			// populate the collection from the response
			if( Array.isArray( data ) ){
				data.forEach(function( item ){ self.add( item ); });
			} else if( data ) {
				self.add( data );
			}
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
		// integer -> array index (preserves existing behaviour)
		if( Number.isInteger( key ) ) return this.data[ key ];
		// id or cid -> O(1) via the index
		if( this._byId[ key ] != null ) return this._byId[ key ];
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
	isOnline(){
		return ( !_.isUndefined( app ) ) ? app.state.online : true;
	}

}
