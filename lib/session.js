/*
 * Session
 * Based on Backbone.Session: https://github.com/makesites/backbone-session
 * Copyright © Makesites.org
 */


 class Session extends Model {

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

		// pick a persistance solution
		if( !this.options.persist && typeof sessionStorage != "undefined" && sessionStorage !== null ){
			// choose localStorage
			this.store = sessionStore;
		} else if( this.options.persist && typeof localStorage != "undefined" && localStorage !== null ){
			// choose localStorage
			this.store = localStore;
		} else {
			// otherwise we need to store data in a cookie
			this.store = cookieStore;
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
let sessionStore = {
	get : function( name ) {
		return sessionStorage.getItem( name );
	},
	set : function( name, val ){
		// validation first?
		return sessionStorage.setItem( name, val );
	},
	check : function( name ){
		return ( sessionStorage.getItem( name ) == null );
	},
	clear: function( name ){
		// actually just removing the session...
		return sessionStorage.removeItem( name );
	}
};

let localStore = {
	get : function( name ) {
		return localStorage.getItem( name );
	},
	set : function( name, val ){
		// validation first?
		return localStorage.setItem( name, val );
	},
	check : function( name ){
		return ( localStorage.getItem( name ) == null );
	},
	clear: function( name ){
		// actually just removing the session...
		return localStorage.removeItem( name );
	}
};

let cookieStore = {
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
	},

	set : function( name, val ){
		// automatically expire session in a day
		var expiry = 86400000;
		var date = new Date( Date.now() + parseInt(expiry) );
		var value = encodeURIComponent(val) + "; expires=" + date.toUTCString();
		document.cookie = name + "=" + value;
	},

	check : function( name ){
		var cookie=this.get( name );
		if (cookie!=null && cookie!=""){
			return true;
		} else {
			return false;
		}
	},

	clear: function( name ) {
		document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
	}
};
