import { Model } from "./model.js";
import { _ } from "./utils.js";

/*
 * Session
 * Based on Backbone.Session: https://github.com/makesites/backbone-session
 * Copyright © Makesites.org
 */


 class Session extends Model {

	/**
	 * @param {Object} [model] - initial attributes
	 * @param {Object} [options] - { host, url, local, remote, broadcast, persist }
	 */
	constructor( model, options ){
		// fallback(s)
		options = options || {};
		// session-specific defaults, merged over any passed options
		var defaults = {
			auth: 0,
			updated: 0,
			broadcast: true,
			local: true,
			remote: true,
			persist: false,
			host: ""
		};
		var opts = _.extend({}, defaults, options);
		// inherit the Model (this also runs initialize())
		super( model, opts );
	}

	initialize(){

		// initial session state
		this.state = false;
		// bind context so these also work when passed as detached callbacks
		// (Base.on already applies the right context, so this is belt-and-braces)
		this.update = this.update.bind(this);
		this.cache = this.cache.bind(this);
		this.logout = this.logout.bind(this);
		this.error = this.error.bind(this);
		// replace the whole URL if supplied
		if( this.options.url ) this.url = this.options.url;

		// pick a persistance solution. These are capability checks, not `typeof`
		// checks: Node >= 22 defines localStorage/sessionStorage globals that may
		// have no working methods, and a browser with site data blocked exposes
		// the object but throws on access (see the note in cache.js).
		if( !this.options.persist && sessionStore.available() ){
			this.store = sessionStore;
		} else if( this.options.persist && localStore.available() ){
			this.store = localStore;
		} else if( cookieStore.available() ){
			// otherwise we need to store data in a cookie
			this.store = cookieStore;
		} else {
			// no browser storage at all (SSR): keep the session in memory so the
			// model still works for the life of the process
			this.store = memoryStore;
		}

		// try loading the session
		var localSession = this.store.get("session");
		//
		if( _.isNull(localSession) || !this.options.local ){
			// - no valid local session, try the server
			this.fetch();
		} else {
			this.set( JSON.parse( localSession ) );
			// reset the updated flag
			this.set({ updated : 0 });
			// fetch if not authenticated (every time)
			if( !this.get('auth') && this.options.remote ) this.fetch();
			// sync with the server ( if broadcasting local info )
			if( this.options.broadcast ) this.save();
		}

		// event binders
		this.bind("change",this.update);
		this.bind("error", this.error);
		this.on("logout", this.logout);
	}


	url(){ return this.options.host + "/session"; }

	parse( data ) {
		// if there is no response, keep what we've got locally
		if( _.isNull(data) ) return;
		// add updated flag
		if( typeof data.updated == "undefined" ){
			data.updated = Date.now();
		}
		// add an id if one is not supplied
		if( !data.id) data.id = this.generateUid();
		return data;
	}

	sync(method, model, options) {
		// fallbacks
		options = options || {};
		// exit if explicitly noted as not calling a remote
		if( !this.options.remote || (!this.options.broadcast && method != "read") ){
			this.update();
			// keep the Promise contract of the native sync layer
			return Promise.resolve();
		}
		// delegate to the native fetch()-based Model.sync
		return super.sync(method, model, options);
	}

	update(){
		// set a trigger
		if( !this.state ) {
			this.state = true;
			this.trigger("loaded");
		}
		// caching is triggered after every model update (fetch/set)
		if( this.get("updated") || !this.options.remote ){
			this.cache();
		}
	}

	cache(){
		// update the local session
		this.store.set("session", JSON.stringify( this.toJSON() ) );
		// check if the object has changed locally
		//...
	}

	// Destroy session - Source: http://backbonetutorials.com/cross-domain-sessions/
	logout( options ){
		// Do a DELETE to /session and clear the clientside data
		var self = this;
		options = options || {};
		// delete local version
		this.store.clear("session");
		// notify remote
		this.destroy({
			wait: true,
			success: function (model, resp) {
				model.clear();
				model.id = null;
				// Set auth to false to trigger a change:auth event
				// The server also returns a new csrf token so that
				// the user can relogin without refreshing the page
				self.set({auth: false});
				if( resp && resp._csrf) self.set({_csrf: resp._csrf});
				// reload the page if needed
				if( options.reload ){
					window.location.reload();
				}
			}
		});
	}

	// if data request fails request offline mode.
	error( model, req, options, error ){
		// consider redirecting based on statusCode
		console.log( req );
	}

	// Helpers
	// - Creates a unique id for identification purposes
	generateUid( separator ){

		var delim = separator || "-";

		function S4() {
			return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
		}

		return (S4() + S4() + delim + S4() + delim + S4() + delim + S4() + delim + S4() + S4() + S4());
	}
}


// Stores
// Each exposes the same tiny contract: available() / get() / set() / check() /
// clear(). `available()` is a capability probe rather than a `typeof` check -
// see the note in cache.js - and the accessors never throw, so a locked-down
// browser degrades instead of breaking the session.
// `check( name )` uniformly answers "is this slot EMPTY?" (cookieStore used to
// answer the opposite, which made the three implementations disagree).

let sessionStore = {
	available : function(){
		try {
			return typeof sessionStorage !== "undefined" && sessionStorage !== null
				&& typeof sessionStorage.getItem === "function"
				&& typeof sessionStorage.setItem === "function";
		} catch( e ){ return false; }
	},
	get : function( name ) {
		try { return sessionStorage.getItem( name ); } catch( e ){ return null; }
	},
	set : function( name, val ){
		try { return sessionStorage.setItem( name, val ); } catch( e ){ return false; }
	},
	check : function( name ){
		return sessionStore.get( name ) == null;
	},
	clear: function( name ){
		// actually just removing the session...
		try { return sessionStorage.removeItem( name ); } catch( e ){ return false; }
	}
};

let localStore = {
	available : function(){
		try {
			return typeof localStorage !== "undefined" && localStorage !== null
				&& typeof localStorage.getItem === "function"
				&& typeof localStorage.setItem === "function";
		} catch( e ){ return false; }
	},
	get : function( name ) {
		try { return localStorage.getItem( name ); } catch( e ){ return null; }
	},
	set : function( name, val ){
		try { return localStorage.setItem( name, val ); } catch( e ){ return false; }
	},
	check : function( name ){
		return localStore.get( name ) == null;
	},
	clear: function( name ){
		// actually just removing the session...
		try { return localStorage.removeItem( name ); } catch( e ){ return false; }
	}
};

let cookieStore = {
	available : function(){
		try { return typeof document !== "undefined" && typeof document.cookie === "string"; }
		catch( e ){ return false; }
	},

	get : function( name ) {
		var i,key,value,cookies=document.cookie.split(";");
		for (i=0;i<cookies.length;i++){
			key=cookies[i].substr(0,cookies[i].indexOf("="));
			value=cookies[i].substr(cookies[i].indexOf("=")+1);
			key=key.replace(/^\s+|\s+$/g,"");
			if (key==name){
				return decodeURIComponent(value);
			}
		}
		return null;
	},

	set : function( name, val ){
		// automatically expire session in a day
		var expiry = 86400000;
		var date = new Date( Date.now() + parseInt(expiry) );
		var value = encodeURIComponent(val) + "; expires=" + date.toUTCString();
		document.cookie = name + "=" + value;
	},

	check : function( name ){
		return cookieStore.get( name ) == null;
	},

	clear: function( name ) {
		document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
	}
};

// last-resort, in-process store so a Session constructed without any browser
// storage (SSR, a worker without cookies) still behaves instead of throwing
let memoryStore = {
	_data : Object.create( null ),
	available : function(){ return true; },
	get : function( name ){ return ( name in memoryStore._data ) ? memoryStore._data[name] : null; },
	set : function( name, val ){ memoryStore._data[name] = String( val ); return true; },
	check : function( name ){ return memoryStore.get( name ) == null; },
	clear : function( name ){ delete memoryStore._data[name]; return true; }
};

export { Session };
