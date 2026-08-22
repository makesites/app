/*
 * Events
 * An application-wide, decoupled pub/sub bus (the mediator pattern). Publishers
 * and subscribers rendezvous on named events without holding a reference to one
 * another - unlike Base's on/trigger, which observe a specific object.
 *
 * Events are delivered in-page immediately (via the Base event registry) and,
 * when available, mirrored to other tabs/windows of the same origin using a
 * BroadcastChannel. Cross-tab payloads are structured-cloned, so non-cloneable
 * values (functions, DOM nodes, class instances) are delivered locally only.
 *
 *   const bus = new Events("app");
 *   bus.on("slideshow:next", (frame) => caption.show(frame)); // decoupled
 *   bus.trigger("slideshow:next", 3);   // local listeners + other tabs
 *
 * Copyright © Makesites.org
 */

class Events extends Base {

	constructor( name, options ){
		// fallback(s)
		options = options || {};
		super( options );
		// the channel name (topic namespace)
		this.name = name || "app";
		// bridge to other browsing contexts unless disabled / unavailable
		this.broadcast = ( options.broadcast !== false ) && ( typeof BroadcastChannel !== "undefined" );
		if( this.broadcast ){
			this._channel = new BroadcastChannel( this.name );
			var self = this;
			this._channel.addEventListener("message", function( e ){
				var msg = e.data || {};
				// re-emit a remote event to local listeners only (no re-broadcast)
				self._emit( msg.event, msg.args || [] );
			});
		}
	}

	// publish an event: deliver to local listeners and (optionally) other tabs
	trigger( name ){
		var args = Array.prototype.slice.call( arguments, 1 );
		// local, same-tab delivery
		this._emit( name, args );
		// cross-tab delivery (structured-clone; stays local-only if not cloneable)
		if( this._channel ){
			try {
				this._channel.postMessage({ event: name, args: args });
			} catch( e ){
				// payload not structured-cloneable - already delivered locally
			}
		}
		return this;
	}

	// deliver to local listeners via the Base registry (without re-broadcasting)
	_emit( name, args ){
		return Base.prototype.trigger.apply( this, [name].concat( args ) );
	}

	// tear down the cross-tab channel and drop all listeners
	close(){
		if( this._channel ) this._channel.close();
		this._channel = null;
		this.off();
	}
}
