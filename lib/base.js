
class Base {

	constructor( options ){
		// fallback(s)
		options = options || {};
		// variables
		this.states = options.states || {}; // delete options.states?

		this.initStates();

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
		// listeners list
		this._delegateEvents = [];
		this.undelegateEvents();
		const enames = Object.keys(events);
		enames.forEach(key => {
			var method = events[key];
			if( typeof method !== 'function' ) method = this[method];
			if( !method ) return;
			var match = key.match(delegateEventSplitter);
			self.el.querySelectorAll(match[2]).forEach( function(el){
				let type = match[1] + '.delegateEvents' + self.cid;
				let listener = method.bind(self);
				el.addEventListener( type, listener );
				self._delegateEvents.push({target: self, type: type, listener: listener});
			});
		});
		return this;
	}

	// Source: https://stackoverflow.com/a/47117084
	undelegateEvents(){

		let _listeners = this._delegateEvents || [];
		for( var index = 0; index != _listeners.length; index++ ){
			var item = _listeners[index];

			var target = item.target;
			var type = item.type;
			var listener = item.listener;

			if(target == this && type.indexOf('.delegateEvents'+this.cid) > -1){
				this.el.removeEventListener(type, listener);
			}
		}
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

	// States
	// Source: https://github.com/makesites/backbone-states

	initStates(){
		for(var e in this.states){
			var method = this.states[e];
			this.bind(e, _.bind(this[method], this) );
		}
	}
}
