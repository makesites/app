/*
 * Observable
 * The event system, on its own: on / off / once / trigger plus the
 * inversion-of-control listenTo / listenToOnce / stopListening.
 *
 * Extracted from Base so that *any* object can be made observable without
 * dragging in element handling, delegated DOM events and the state machine —
 * the role Backbone.Events fills as a mixin. `Base` extends it, so every
 * Model / Collection / View / Router keeps the exact same API.
 *
 *   class Player extends Observable {
 *     play(){ this.trigger("play", this.track); }
 *   }
 *
 * Copyright © Makesites.org
 */

/**
 * A listener invoked by {@link Observable#trigger}. Arguments are whatever the
 * emitter passed after the event name.
 * @typedef {(...args: any[]) => void} EventCallback
 */

class Observable {

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
	 * {@link Observable#stopListening} (e.g. when a view is removed).
	 * @param {Observable} obj - the object to observe
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
	 * Listen to another object's event exactly once, then drop the binding.
	 * Tracked like {@link Observable#listenTo}, so {@link Observable#stopListening}
	 * also clears it if the event never fires.
	 * @param {Observable} obj - the object to observe
	 * @param {string} name - event name(s)
	 * @param {EventCallback} callback - runs with THIS object as context
	 * @returns {this}
	 */
	listenToOnce( obj, name, callback ){
		if( !obj ) return this;
		var self = this;
		var once = function(){
			self.stopListening( obj, name, once );
			return callback.apply( this, arguments );
		};
		once._callback = callback;
		return this.listenTo( obj, name, once );
	}

	/**
	 * Stop listening. With no arguments drops every listenTo binding; otherwise
	 * filters by object, event name and/or callback.
	 * @param {Observable} [obj]
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

}

