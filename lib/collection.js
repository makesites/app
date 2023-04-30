
class Collection {
	constructor( options ) {
		// merge options
		options = options || {};
		this.options = this.constructor.defaults;
		this.options = utils.extend( {}, this.options, options );
		//...

		this.initialize();
	}

	initialize(){

	}

	render(){

	}

}

// defaults
Collection.defaults = {};


export { Collection };
