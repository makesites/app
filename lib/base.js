
/**
 * A listener invoked by {@link Base#trigger}. Arguments are whatever the
 * emitter passed after the event name.
 * @typedef {(...args: any[]) => void} EventCallback
 */

class Base {

	/**
	 * @param {Object} [options]
	 * @param {Object} [options.states] - state -> handler-name map, merged with the class's own
	 */
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
	 * @param {EventCallback} callback
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

	/**
	 * Subscribe to an event, firing the callback at most once.
	 * @param {string} name - event name(s)
	 * @param {EventCallback} callback
	 * @param {Object} [context]
	 * @returns {this}
	 */
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

	/**
	 * Remove callbacks. With no arguments removes all; otherwise filters by
	 * event name, callback and/or context.
	 * @param {string} [name]
	 * @param {EventCallback} [callback]
	 * @param {Object} [context]
	 * @returns {this}
	 */
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
	trigger( name, ...args ){
		if( !this._events ) return this;
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
	 * @param {EventCallback} callback - runs with THIS object as context
	 * @returns {this}
	 */
	listenTo( obj, name, callback ){
		if( !obj ) return this;
		var listeningTo = this._listeningTo || (this._listeningTo = []);
		listeningTo.push({ obj: obj, name: name, callback: callback });
		obj.on( name, callback, this );
		return this;
	}

	/**
	 * Stop listening. With no arguments drops every listenTo binding; otherwise
	 * filters by object, event name and/or callback.
	 * @param {Base} [obj]
	 * @param {string} [name]
	 * @param {EventCallback} [callback]
	 * @returns {this}
	 */
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
		// stop resize monitoring. This has to be the *bound* handler that was
		// registered (`_onResize`): removeEventListener matches by identity, so
		// passing the prototype method `this._resize` removed nothing.
		if( typeof window !== "undefined" && this._onResize ){
			window.removeEventListener( "resize", this._onResize );
		}
		this._onResize = null;
		// drop a pending debounced resize so it can't fire after teardown
		if( this._resizeTimer ){
			clearTimeout( this._resizeTimer );
			this._resizeTimer = null;
		}
		return this;
	}

	// Remove DOM listeners this object registered on `this.el`.
	// - no arguments: every delegated listener (same as undelegateEvents)
	// - a type: the delegated listeners for that event type
	// - a type + callback: that specific listener
	//
	// This used to "remove all listeners" by replacing `this.el` with a clone of
	// itself. That was destructive: `this.el` kept pointing at the *original*,
	// which replaceWith had just detached from the document — so a View that was
	// handed an existing element (`new View({ el: "#main" })`) rendered into an
	// orphan node while an empty clone sat where the element used to be, and
	// `_inDOM()` then re-appended the orphan to the end of <body>, duplicating
	// the id. It also silently dropped listeners the framework never added.
	// Delegated listeners are tracked in `_delegateEvents`, so no clone is needed.
	unbind( name, cb ){
		if( !name ) return this.undelegateEvents();
		var listeners = this._delegateEvents || [];
		var remaining = [];
		for( var i = 0; i < listeners.length; i++ ){
			var listener = listeners[i];
			if( listener.type === name && ( !cb || listener.handler === cb ) ){
				if( this.el ) this.el.removeEventListener( listener.type, listener.handler );
			} else {
				remaining.push( listener );
			}
		}
		this._delegateEvents = remaining;
		// also drop a listener registered directly (not through delegateEvents)
		if( cb && this.el ) this.el.removeEventListener( name, cb );
		return this;
	}

	delegateEvents( events ){
		// merge the class's built-in events (_baseEvents) with the subclass's
		// events, resolved via a getter or own-property (so getters don't throw)
		events = events || _.extend({}, this._baseEvents, _.result(this, 'events'));
		if( !events || !this.el ) return this;
		this.undelegateEvents();
		var self = this;
		var splitter = /^(\S+)\s*(.*)$/;
		Object.keys( events ).forEach(function( key ){
			var method = events[key];
			if( typeof method !== 'function' ) method = self[method];
			if( !method ) return;
			var match = key.match( splitter );
			var type = match[1], selector = match[2];
			// True native delegation: ONE listener per event type on the root
			// element, resolving the selector at dispatch time (so dynamically-
			// added elements are handled too). Replaces the previous approach,
			// which bound jQuery-style namespaced types ("click.delegateEvents<cid>")
			// that native addEventListener never actually fires.
			var handler = function( e ){
				if( !selector ){
					method.call( self, e );
				} else {
					var target = e.target.closest( selector );
					if( target && self.el.contains( target ) ) method.call( self, e, target );
				}
			};
			self.el.addEventListener( type, handler );
			self._delegateEvents.push({ type: type, handler: handler });
		});
		return this;
	}

	undelegateEvents(){
		var listeners = this._delegateEvents || [];
		if( this.el ){
			for( var i = 0; i < listeners.length; i++ ){
				this.el.removeEventListener( listeners[i].type, listeners[i].handler );
			}
		}
		this._delegateEvents = [];
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
