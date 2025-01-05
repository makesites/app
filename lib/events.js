//import { Model, Collection } from "https://unpkg.com/@makesites/app/dist/app.min.js";

class Events {

	constructor() {

		this.data = new Collection();

	}

	// creates a new event named after the key
	add( key ) {
		var data = new Model({
			id: key,
			event: new BroadcastChannel( key )
		});
		this.data.add( data );
	}

	// returns a "naked" event object
	get( key ){
		return this.data.get( key ).get('event');
	}

	listen( key, fn ) {
		var event = this.get(key);
		event.addEventListener("message", fn);
	}

	trigger( key, values ) {
		var e = this.data.get( key ).get("event"); // failure safe?
		e.postMessage( values );
	}
}

//export { Events };
