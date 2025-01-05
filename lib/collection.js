
class Collection extends Base {

	constructor( models, options={} ) {
		// defaults
		this.defaults = {
			_synced : false,
			autofetch: false,
			cache: false
		};

		// the "item" of the collection can be defined on instantiation or default ot the base Model
		this.model = options.model || Model;
		// at it's core the collection is a "dumb" array of data that we will perform operations on.
		this.data = [];

		// merge options
		options = options || {};
		//this.options = this.constructor.defaults;
		this.options = _.extend( {}, this.defaults, options );
		//this.options = _.extend({}, this.defaults, options);
		//...

		this.cid = _.uniqueId("collection");

		this.initialize();
	}

	// initialization
	initialize(){
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

	// adds a single model
	add( data ) {
		// check if the supplied data is already a model
		var model = ( data.cid && data.cid.includes("model") )
			? data
			: new this.model( data );
		// add at the end of the models array
		this.data.push( model );
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

	cache(){
		// optionally create your own custom a cache mechanism...
		return Backbone.Collection.prototype.cache || false;
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
