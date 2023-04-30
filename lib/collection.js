
class Collection {
	constructor( options ) {
		// defaults
		this.defaults = {};
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


export { Collection };
