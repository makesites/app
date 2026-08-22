
class Base {

	constructor( options ){
		// fallback(s)
		options = options || {};
		// states passed via options are merged with the class's own states at
		// init time (we never assign `this.states`, so subclass getters work)
		this._optionStates = options.states || {};

		this.initStates();

	}

	// Events
	// A minimal pub/sub registry. Unlike the previous EventTarget approach this
	// passes the trigger arguments straight through to the callback and invokes
	// it with the right `this` (the listening object, or an explicit context).

	// alias of "on"
	bind( name, cb, context ){
		return this.on( name, cb, context );
	}

	/**
	 * Subscribe to an event. Supports space-separated names ("add remove").
	 * @param {string} name - event name(s)
	 * @param {Function} callback
	 * @param {Object} [context] - `this` inside the callback (defaults to this object)
	 * @returns {this}
	 */
	on( name, callback, context ){
		if( !callback ) return this;
		this._events || (this._events = {});
		// support space-separated event names ("add remove reset change")
		var names = String(name).split(/\s+/);
		for( var k = 0; k < names.length; k++ ){
			var handlers = this._events[names[k]] || (this._events[names[k]] = []);
			handlers.push({ callback: callback, context: context, ctx: context || this });
		}
		return this;
	}

	// subscribe to an event, but only fire the callback once
	once( name, callback, context ){
		var self = this;
		var ran = false;
		var wrap = function(){
			if( ran ) return;
			ran = true;
			self.off( name, wrap );
			return callback.apply( this, arguments );
		};
		wrap._callback = callback;
		return this.on( name, wrap, context );
	}

	// remove callbacks. With no args removes all; by name / callback / context.
	off( name, callback, context ){
		if( !this._events ) return this;
		if( !name && !callback && !context ){ this._events = {}; return this; }
		var names = name ? String(name).split(/\s+/) : Object.keys( this._events );
		for( var i = 0; i < names.length; i++ ){
			var n = names[i];
			var handlers = this._events[n];
			if( !handlers ) continue;
			if( !callback && !context ){ delete this._events[n]; continue; }
			var remaining = [];
			for( var j = 0; j < handlers.length; j++ ){
				var h = handlers[j];
				if( (callback && callback !== h.callback && callback !== h.callback._callback) || (context && context !== h.context) ){
					remaining.push( h );
				}
			}
			if( remaining.length ) this._events[n] = remaining; else delete this._events[n];
		}
		return this;
	}

	/**
	 * Emit an event, passing any extra arguments to the listeners.
	 * @param {string} name - event name(s)
	 * @param {...*} args - forwarded to each listener
	 * @returns {this}
	 */
	trigger( name ){
		if( !this._events ) return this;
		var args = Array.prototype.slice.call( arguments, 1 );
		// support triggering several space-separated events at once
		var names = String(name).split(/\s+/);
		for( var k = 0; k < names.length; k++ ){
			var handlers = this._events[names[k]];
			if( handlers ) this._triggerHandlers( handlers, args );
			// "all" catch-all events receive the name as the first argument
			var all = this._events.all;
			if( all ) this._triggerHandlers( all, [names[k]].concat( args ) );
		}
		return this;
	}

	// iterate over a copy so listeners may (un)subscribe during dispatch
	_triggerHandlers( handlers, args ){
		var list = handlers.slice();
		for( var i = 0; i < list.length; i++ ){
			list[i].callback.apply( list[i].ctx, args );
		}
	}

	// Inversion-of-control listening. Tell *this* object to listen to another
	// object's events (bound to this context) and remember the binding so it can
	// be torn down in one call - crucial for avoiding leaks when views are removed.
	/**
	 * Listen to another object's event, tracked so it can be torn down via
	 * {@link Base#stopListening} (e.g. when a view is removed).
	 * @param {Base} obj - the object to observe
	 * @param {string} name - event name(s)
	 * @param {Function} callback - runs with THIS object as context
	 * @returns {this}
	 */
	listenTo( obj, name, callback ){
		if( !obj ) return this;
		var listeningTo = this._listeningTo || (this._listeningTo = []);
		listeningTo.push({ obj: obj, name: name, callback: callback });
		obj.on( name, callback, this );
		return this;
	}

	// Stop listening. With no args, drops every listenTo binding; otherwise
	// filters by object / event name / callback.
	stopListening( obj, name, callback ){
		var listeningTo = this._listeningTo;
		if( !listeningTo ) return this;
		var remaining = [];
		for( var i = 0; i < listeningTo.length; i++ ){
			var l = listeningTo[i];
			var match = ( !obj || obj === l.obj ) && ( !name || name === l.name ) && ( !callback || callback === l.callback );
			if( match ){
				l.obj.off( l.name, l.callback, this );
			} else {
				remaining.push( l );
			}
		}
		this._listeningTo = remaining;
		return this;
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
		// merge the class's built-in events (_baseEvents) with the subclass's
		// events, resolved via a getter or own-property (so getters don't throw)
		events = events || _.extend({}, this._baseEvents, _.result(this, 'events'));
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
		// resolve states from the class built-ins (_baseStates) + the subclass
		// (getter/own-property) + any passed via options, without assigning
		// `this.states` (so subclass getters don't throw). Uses native Object.assign
		// (not `_`) because this runs at module load for the history singleton,
		// before the `_` utils instance exists.
		var states = Object.assign({}, this._baseStates, this.states, this._optionStates);
		for( var e in states ){
			var method = states[e];
			if( typeof this[method] === 'function' ) this.bind( e, this[method].bind(this) );
		}
	}
}
