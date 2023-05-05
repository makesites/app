
class Base {

	constructor(){

	}

	// Events

	bind( name, cb ){

		// alias of "on"
		this.on( name , cb, false);

	}

	on( name, cb ){

		// Listen for the event.
		this._e.addEventListener( name , cb, false);

	}

	trigger( name, ctx, options ){
		const e = new Event( name );

		// Dispatch the event.
		this._e.dispatchEvent( e, ctx, options );

	}

	remove() {
		// stop resize monitoring
		window.removeEventListener( "resize", this._resize );

		// don't forget to call the original remove() function
		//Backbone.View.prototype.remove.call(this);
	}

	unbind( name, cb ){
		if( !name ){
			console.log( this.el );
			// Remove all event listeners from Element by cloning it
			this.el.replaceWith( this.el.cloneNode(true) );
		} else if( !cb ) {
			// remove specific event
			this.el.removeEventListener( name );
		} else {
			// remove specific event
			this.el.removeEventListener( name, cb );
		}
	}

	delegateEvents( events ){
		events =  events || _.result(this, 'events');
		var self = this;
		var delegateEventSplitter = /^(\S+)\s*(.*)$/;
		if (!events) return this;
		this.undelegateEvents();
		const enames = Object.keys(events);
		enames.forEach(key => {
			var method = events[key];
			if( typeof method !== 'function' ) method = this[method];
			if( !method ) return;
			var match = key.match(delegateEventSplitter);
			self.el.querySelectorAll(match[2]).forEach( (el) => (el.addEventListener(match[1] + '.delegateEvents' + self.cid, method.bind(self)) ));
		});
		return this;
	}

	undelegateEvents(){

		//this.el.removeAllListeners('.delegateEvents' + this.cid, function(event) {
		//	event.stopImmediatePropagation();
		//}, true);
		return this;
	}

	// Element
	setElement( element ){
		this.undelegateEvents();
		this._setElement(element);
		this.delegateEvents();
		return this;
	}

	// TODO: internal method to do more than just save the element
	_setElement( el ){
		this.el = el;
	}

/*
	unbind( types, fn ) {
		return this.off( types, null, fn );
	}
*/
}
