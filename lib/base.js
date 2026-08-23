
class Base extends Observable {

	/**
	 * @param {Object} [options]
	 * @param {Object} [options.states] - state -> handler-name map, merged with the class's own
	 */
	constructor( options ){
		super();
		// fallback(s)
		options = options || {};
		// states passed via options are merged with the class's own states at
		// init time (we never assign `this.states`, so subclass getters work)
		this._optionStates = options.states || {};

		this.initStates();

	}

	// Events are inherited from Observable (on/off/once/trigger/listenTo/...)

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
