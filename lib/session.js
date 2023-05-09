/*
 * Session
 * Based on Backbone.Session: https://github.com/makesites/backbone-session
 * Copyright © Makesites.org
 */


 class Session extends Model {

	constructor( model, options ){
		// default vars
		options = options || {};

		this.defaults = {
			auth: 0,
			updated: 0,
			broadcast: true,
			local: true,
			remote: true,
			persist: false,
			host: ""
		};

		this.state = false;

		// parse options
		this.options = _.extend(this.defaults, options);

		// replace the whole URL if supplied
		if( !_.isUndefined(options.url) ) this.url = options.url;

		// binds
		_.bindAll(this, "logout", "cache", "update");


	}

	initialize(){

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
			data.updated = ( new Date() ).getTime();
		}
		// add an id if one is not supplied
		if( !data.id) data.id = this.generateUid();
		return data;
	}

	sync(method, model, options) {
		// fallbacks
		options = options || {};
		//console.log("method", method);
		// intercept local store actions
		switch(method){
			case "read":

			break;
			case "update":
				//this.store.set("session", JSON.stringify( model.toJSON() ) );
			break;
		}
		// exit if explicitly noted as not calling a remote
		if( !this.options.remote || (!this.options.broadcast && method != "read") ) return this.update();

		return Backbone.sync.call(this, method, model, options);
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
				return unescape(value);
			}
		}
	},

	set : function( name, val ){
		// automatically expire session in a day
		var expiry = 86400000;
		var date = new Date( ( new Date() ).getTime() + parseInt(expiry) );
		var value=escape(val) + ((expiry==null) ? "" : "; expires="+date.toUTCString());
		document.cookie=name + "=" + value;
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
