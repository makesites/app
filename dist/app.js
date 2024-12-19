/**
 * @name @makesites/app
 * 
 *
 * Version: 0.6.0 (Thu, 19 Dec 2024 07:18:50 GMT)
 * Source: 
 *
 * @author makesites
 * Distributed by [Makesites.org](http://makesites.org)
 *
 * @license Released under the MPL v2.0, AGPL v3.0 licenses
 */

//import { APP } from "./app.js";



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


class Collection extends Base {

	constructor( models, options ) {
		// defaults
		this.defaults = {
			_synced : false,
			autofetch: false,
			cache: false
		};

		this.model = Model;

		// merge options
		options = options || {};
		//this.options = this.constructor.defaults;
		this.options = _.extend( {}, this.defaults, options );
		//this.options = _.extend({}, this.defaults, options);
		//...

		this.cid = _.uniqueId("collection");

		this.initialize();
	}

	// initialization
	initialize(){
		// restore cache
		if( this.options.cache ){
			var cache = this.cache();
			if( cache ) this.add( cache );
		}
		// auto-fetch if no models are passed
		if( this.options.autofetch && _.isEmpty(models) && this.url ){
			this.fetch();
		}
	}

	render(){

	}

	update(){

	}

	save(models, options){
		// merge models
		_.extend(this.models, models);
		// callback is run once, after all models have saved.
		if( options.success ){
			var callback = _.after(this.models.length, options.success);
			_.each( this.models, function( model ){
				model.save(null, {success: callback});
			});
		}
	}

	cache(){
		// optionally create your own custom a cache mechanism...
		return Backbone.Collection.prototype.cache || false;
	}

	parse( data ){
		var self = this;
		setTimeout(function(){ self.trigger("fetch"); }, 200); // better way to trigger this after parse?
		// cache results
		if( this.options.cache ){
			this.cache( data );
		}
		return data;
	}

	// extract data (and possibly filter keys)
	output(){
		// in most cases it's a straight JSON output
		return this.toJSON();
	}

	isNew() {
		return this.options._synced === false;
	}

	// - check if the app is online
	isOnline(){
		return ( !_.isUndefined( app ) ) ? app.state.online : true;
	}

}


class Controller {

	constructor( options ) {
		// defaults
		this.routes = {};

		this.data = new Model();

		// app configuration:
		this.defaults = {
			api : false,
			autostart: true,
			location : false,
			pushState: false,
			p404 : "/"
		};

		// app config refered to as options
		options = options || {};
		// extend default options (recursive?)
		//this.options = _.extend({}, this.defaults, options);
		this.options = _.extend({}, this.defaults, options);

		// to preserve these routes, extend with:
		// _.extend({}, APP.Router.prototype.routes, {...});
		this.routes = {
			"": "index",
			"_=_": "_fixFB",
			"access_token=:token": "access_token",
			"logout": "logout"
			//"*path"  : "_404"
		};

		// Save app state in a seperate object
		this.state = {
			fullscreen: false,
			online: navigator.onLine,
			// find browser type
			browser: function(){
				if( /chrome/.test(navigator.userAgent.toLowerCase()) ) return 'chrome';
				if( /firefox/.test(navigator.userAgent.toLowerCase()) ) return 'firefox';
				if( /safari/.test(navigator.userAgent.toLowerCase()) ) return 'safari';
				if (navigator.appName == 'Microsoft Internet Explorer') return 'ie';
				if( /android/.test(navigator.userAgent.toLowerCase()) ) return 'android';
				if(/(iPhone|iPod).*OS 5.*AppleWebKit.*Mobile.*Safari/.test(navigator.userAgent) ) return 'ios';
				if (navigator.userAgent.indexOf("Opera Mini") !== -1) return 'opera-mini';
				return 'other';
			},
			mobile: (navigator.userAgent.match(/Android/i) || navigator.userAgent.match(/webOS/i) || navigator.userAgent.match(/iPhone/i) || navigator.userAgent.match(/iPod/i) ||navigator.userAgent.match(/BlackBerry/i)),
			ipad: (navigator.userAgent.match(/iPad/i) !== null),
			retina: (window.retina || window.devicePixelRatio > 1),
			// check if there's a touch screen
			touch : ('ontouchstart' in document.documentElement),
			pushstate: function() {
				try {
					window.history.pushState({"pageTitle": document.title}, document.title, window.location);
					return true;
				}
				catch (e) {
					return false;
				}
			},
			scroll: true,
			ram: function(){
				return (console.memory) ? Math.round( 100 * (console.memory.usedJSHeapSize / console.memory.totalJSHeapSize)) : 0;
			},
			standalone: function(){ return (("standalone" in navigator) && navigator.standalone) || (typeof PhoneGap !="undefined" && !_.isUndefined(PhoneGap.env) && PhoneGap.env.app ) || ((typeof external != "undefined") && (typeof external.msIsSiteMode == "function") && external.msIsSiteMode()); },
			framed: (top !== self) // alternatively (window.top !== window)
		};

		this.cid = _.uniqueId("controller");

		this.initialize();

	}

	initialize(){
		// bind 'this' with the methods
		//_.bindAll(this, 'access_token', 'preRoute', '_layoutUpdate', '_bindRoutes', '_callRoute', '_setup', '_ajaxPrefilter','_fixFB');
		// setup app
		this._setup();
		// update Backbone options
		//if( this.options.autostart ) Backbone.history.start({ pushState: this.options.pushState });
	}

	update(){
		// backwards compatibility for a simple state object
		var scroll = (this.state instanceof Backbone.Model ) ? this.state.get("scroll") : this.state.scroll;
		if( scroll ){
			$("body").removeClass("no-scroll");
		} else {
			$("body").addClass("no-scroll");
		}
	}

	// Routes
	// default route - override with custom method
	index(){

	}

	// vanilla logout route
	logout(){
		if( this.session ) this.session.trigger("logout", { reload: true });
		// back to the homepage
		this.navigate("/", true);
	}

	// this method wil be executed before "every" route!
	preRoute( options, callback ){
		var self = this;
		// execute logic here:
		// - check if there is a session
		if( this.session && (typeof this.session.state !== "undefined") ){
			// wait for the session
			if( !this.session.state ){
				return this.session.bind("loaded", _.once(function(){
					callback.apply(self, options);
				}) );
			} else {
				// session available...
				return callback.apply(self, options);
			}
		}
		return callback.apply(self, options);
	}

	access_token( token ){
		// if there's an app session, save it there
		if( this.session ){
			this.session.set({ "token" : token });
		} else {
			// set as a global var (for later use)
			window.access_token = token;
		}
		// either way redirect back to home...
		this.navigate("/", true);
	}

	// - internal
	// collection of setup methods
	_setup(){
		// using options as the main configuration source
		// - use an API URL
		if( this.options.api ) this._ajaxPrefilter( this.options.api );
		// - init analytics
		//this.bind('all', this._trackPageview);
		//this.bind('all', this._layoutUpdate);

		// - monitor user's location
		if( this.options.location ){
			this._geoLocation();
		}
		// - setup session
		this._setupSession();
	}

	// - setup session, if namespace is available
	_setupSession(){
		// fallback to backbone.session
		//var Session = APP.Session || Backbone.Session || false;
		//if( Session ) this.session = new Session({}, ( this.options.session || {} ));
	}

	// set the api url for all ajax requests
	_ajaxPrefilter( api ){
		var session = this.session || false;

		$.ajaxPrefilter( function( options, originalOptions, jqXHR ) {
			//#29 - apply api url only for data requests
			if( originalOptions.dataType != "json" ) return;
			// use the api from the configuration (unless full URL specified)
			var fullUrl = (options.url.search(/^http/) === 0);
			if( !fullUrl ){
				options.url = api + options.url;
			}
			// compatible with servers that set header
			// Access-Control-Allow-Credentials: true
			// for added security
			options.xhrFields = {
				withCredentials: true
			};
			// If we have a csrf token send it through with the next request
			var csrf = (session) ? (session._csrf || session.get('_csrf') || false) : false;
			if( csrf ) {
				jqXHR.setRequestHeader('X-CSRF-Token', csrf);
			}
		});

	}

	// addressing the issue: http://stackoverflow.com/q/7131909
	_fixFB(){
		this.navigate("/", true);
	}

	_layoutUpdate(path){
		//update the layout
		if(this.layout) this.layout.trigger("update", { navigate : true, path : path });
	}

	// - overriding default _bindRoutes
	_bindRoutes(){
		if (!this.routes) return;
		this.routes = _.result(this, 'routes');
		var route, routes = _.keys(this.routes);
		while(typeof (route = routes.pop()) !== "undefined"){
			var name = this.routes[route];
			// when we find the route we execute the preRoute
			// with a reference to the route as a callback...
			this.route(route, name, this._callRoute( this[name] ) );
		}
	}

	// special execution of a route (with pre-logic)
	_callRoute( route ){
		return function(){
				this.preRoute.call(this, arguments, route);
			};
	}

	_geoLocation(){
		var self = this;
		// get user's location
		navigator.geolocation.getCurrentPosition(
			function( data ){ self.state.location = data; },
			function(){ console.log("error", arguments); }
		);
		// update every 30 sec (to support mobile)
		setTimeout( function(){
			self._geoLocation();
		}, 30000);

	}

	// Fallback 404 route
	_404( path ){
		var msg = "Unable to find path: " + path;
		console.log(msg);
		// redirect to 404 path
		this.navigate( this.options.p404 );
	}

}


class Model extends Base {

	constructor( model, options ) {
		super( options );

		this.defaults = {
			autofetch: false,
			cache: false
		};

		this.attributes = {};

		// events
		// - hidden target
		this._e = new EventTarget();

		// save options for later
		options = options || {};
		this.options = _.extend({}, this.defaults, options);
		// set data if given
		//if( !_.isNull( model ) && !_.isEmpty( model ) ) this.set( model );
		if( typeof model == "object" ) this.set( model );

		this.cid = _.uniqueId("model");

		this.initialize();
	}

	// initialization
	initialize(){
		// restore cache
		if( this.options.cache ){
			var cache = this.cache();
			if( cache ) this.set( cache );
		}
		// auto-fetch if no models are passed
		if( this.options.autofetch && !_.isUndefined(this.url) ){
				this.fetch();
		}
	}

	// Getter/Setter

	// add is like set but only if not available
	add( obj ){
		var self = this;
		var data = {};
		_.each( obj, function( item, key ){
			if( _.isUndefined( self.get(key) ) ){
				data[key] = item;
			}
		});
		this.set( data );
	}

	// Get the value of an attribute.
	get( attr ){
		return this.attributes[attr];
	}

	has( attr ){
		return this.get(attr) != null;
	}

	// Set a hash of model attributes on the object, firing `"change"`.
	// Based on Backbone.js Model.set
	set( key, val, options ){
		if (key == null) return this;

		// Handle both `"key", value` and `{key: value}` -style arguments.
		var attrs;
		if (typeof key === 'object') {
			attrs = key;
			options = val;
		} else {
			(attrs = {})[key] = val;
		}

		options = options || {};

		// Extract attributes and options.
		var silent     = options.silent;

		// For each `set` attribute, update or delete the current value.
		for( var attr in attrs ){
			val = attrs[attr];
			this.attributes[attr] = val;
		}

		if (!silent)  this.trigger('change', this, options);

		return this;
	}

	// #63 reset model to its default values
	reset(){
		return this.clear().set(this.defaults);
	}

	// Use cache, if available
	cache(){
		// optionally create your own custom a cache mechanism...
		return ( Model.cache ) ? Model.cache() : false;
	}

	// Events

	on( name, cb ){

		// Listen for the event.
		this._e.addEventListener( name , cb, false);

	}

	trigger( name, ctx, options ){
		const e = new Event( name );

		// Dispatch the event.
		this._e.dispatchEvent( e, ctx, options );

	}

	// Helper functions
	// - check if the app is online
	isOnline(){
		return ( !_.isUndefined( app ) ) ? app.state.online : true;
	}

	getValue (object, prop) {
		if (!(object && object[prop])) return null;
		return _.isFunction(object[prop]) ? object[prop]() : object[prop];
	}

	parse( data ){
		var self = this;
		setTimeout(function(){ self.trigger("fetch"); }, 200); // better way to trigger this after parse?
		// cache response
		if( this.options.cache ){
			this.cache( data );
		}
		return data;
	}

	toJSON( options ){
		var obj = this.attributes;
		if (typeof obj !== 'object') return obj;
		return ( Array.isArray(obj) ) ? obj.slice() : _.extend({}, obj);
	}

	// extract data (and possibly filter keys)
	output(){
		// in most cases it's a straight JSON output
		return this.toJSON();
	}

}


class View extends Base {

	constructor( options ){
		// fallback(s)
		options = options || {};
		//
		super( options );
		// element
		this.el = this._getEl( options );
		// find the data
		this.data = options.data || this.model || this.collection || null;
		// containers
		//var state = Backbone.View.prototype.state || new Backbone.Model();
		this.state = new Model();
		// defaults
		this.state.set({
			loaded : false,
			scroll : false,
			visible : false
		});
		// A simple state machine for views.
		this.states = {
			"scroll": "_scroll"
		};

		this.defaults = {
			data : false,
			html: false,
			template: false,
			url : false,
			bind: "add remove reset change", // change the default to "sync"?
			type: false,
			parentEl : false,
			autoRender: true,
			inRender: false,
			silentRender: false,
			renderTarget: false
		};
		// events
		// - hidden target
		this._e = new EventTarget();

		this.events = {
			"click a[rel='external']" : "clickExternal"
		};

		//  extend options
		this.options = _.extend({}, this.defaults, options);
		// flags
		this.options.data  = !_.isNull( this.data );

		this.cid = _.uniqueId("view");

		this.initialize();
	}

	initialize(){
		var self = this;
		// unbind this container from any previous listeners
		this.unbind();
		//
		//_.bindAll(this, 'render', 'clickExternal', 'postRender', 'onLoaded', '_url', '_inDOM', '_toJSON', '_onLoaded');
		//if( typeof this.url == "function" ) _.bindAll(this, 'url');
		//
		this.on('loaded', this._onLoaded.bind(this) );
		this.on('loaded', this.onLoaded.bind(this) );

		// #9 optionally add a reference to the view in the container
		if( this.options.attr ) {
			$(this.el).attr("data-view", this.options.attr );
		} else {
			this.el.removeAttribute("data-view");
		}
		// compile
		var html = ( this.options.html ) ? this.options.html : null;
		// considering url as a flat option (check for string?)
		if( this.url && !this.options.url) this.options.url = this.url;
		// include init options in url()
		var url = this._url( this.options );
		// proxy internal method for future requests
		this.url = this._url;
		// supporting custom templates
		let TMPL = ( this.options.template ) ? this.options.template : Template;

		// set the type to default (as the Template expects)
		if( !this.options.type ) this.options.type = "default";
		this.template = (typeof TMPL == "function") ? new TMPL(html, { url : url }) : TMPL;
		if( self.options.autoRender ) this.template.bind("loaded", this.render);

		// add listeners
		if( this.options.data && !_.isUndefined( this.data.on ) ){
			this.data.on( this.options.bind, this.render);
		}
		// #11 : initial render only if data is not empty (or there are no data)
		if( this._initRender() ){
			this.render();
		} else {
			this.trigger("loaded");
		}
		// #36 - Adding resize event
		window.addEventListener("resize", this._resize.bind(this) );

		this.initStates();
		// initiate parent (states etc.)
		//return Backbone.View.prototype.initialize.call( this, options );
		//return View.prototype.initialize.call(this, options);
	}

	initStates(){
		for(var e in this.states){
			var method = this.states[e];
			this.bind(e, this[method].bind(this) );
		}
	}

	// parse URL in runtime (optionally)
	_url( options ){
		// fallback
		options = options || {};
		var url = options.url || this.options.url;
		return (typeof url == "function")? url() : url;
	}

	preRender(){
	}

	// Render view
	// placing markup in the DOM
	render(){
		// prerequisite
		if( !this.template ) return;
		// execute pre-render actions
		this._preRender();
		//
		var template = this._getTemplate();
		var data = this.toJSON();
		// checking instance of template before executing as a function
		var html = ( template instanceof Function ) ? template( data ) : template;
		// find the render target
		var container = this._findContainer();
		// saving element reference
		if( !this.el ){
			this.el = html; // convert to a Node?
		}
		// make sure the element is attached to the DOM
		this._inDOM();
		// ways to insert the markup
		if( this.options.append ){
			container.append( this.el );
		} else if( this.options.prepend ){
			container.prepend( this.el );
		} else {
			container.innerHTML = html;
		}
		// execute post-render actions
		this._postRender();
	}

	postRender(){
	}

	// a more discrete way of binding events triggers to objects
	listen( obj, event, callback ){
		// adds event listeners to the data
		var e = ( typeof event == "string")? [event] : event;
		for( var i in e ){
			obj.bind(e[i], callback);
		}

	}

	resize( e ){
		// override with your own custom actions...
	}

	clickExternal(e){
		e.preventDefault();
		var url = this.findLink(e.target);
		// track the click with Google Analytics (if available)
		if(typeof pageTracker != "undefined") url = pageTracker._getLinkerUrl(url);
		// #22 - Looking for Phonegap ChildBrowser in external links
		try{
			window.plugins.childBrowser.showWebPage( url );
		} catch( exp ){
			// revert to the redular load
			window.open(url, '_blank');
		}
		return false;
	}

	// attach to an event for a tab like effect
	clickTab(e){
		e.preventDefault();
		let section = this.findLink(e.target);
		let sectionEl = this.el.querySelector( section );
		sectionEl.style.display = 'block';
		var siblings = utils.getSiblings( sectionEl );
		siblings.forEach( (sibling) => (sibling.style.display = 'none') );
		// optionally add selected class if li available
		$(e.target).parent("li").addClass("selected").siblings().removeClass("selected");
	}

	findLink(obj) {
		if (obj.tagName != "A") {
			return $(obj).closest("a").getAttribute("href");
		} else {
			return obj.getAttribute("href");
		}
	}

	toJSON(){
		var data = this._toJSON();
		// #43 - adding options to the template data
		return ( this.options.inRender ) ? { data : data, options: this.options } : data;
	}

	onLoaded(){
		// replace with your own actions on load
	}

	// Helpers

	// call methods from the parent
	parent( method, options ){
		// fallbacks
		method = method || "";
		options = options || {};
		// prerequisites
		this.__inherit = this.__inherit || []; // use promises instead?
		// check what reference of the parent we have available
		// - first is to stop recursion, second is to support for Backbone.APP
		var parent = this.__inherit[method] || this._parent || {};
		// fallback to pure js inheritance
		var proto = parent.prototype || (Object.getPrototypeOf(this)).constructor.__super__; // last MUST exist...
		// else View.__super__ ?
		var fn = proto[method] || function(){
			// reset inheritance
			delete this.__inherit[method];
		}; // fallback necessary?
		// convert arguments to an array
		var args = (options instanceof Array) ? options: [options];
		// stop recursion by saving a reference to the next parent
		this.__inherit[method] = proto._parent || function(){};
		//
		return fn.apply(this, args);
	}

	// Internal methods
	_getEl( options ){
		var el = options.el || document.createElement("div");
		//lookup element
		if(typeof el == "string") el = document.querySelector( el );

		return el;
	}


	// - render

	_initRender(){
		if( !this.options.autoRender ) return false;
		// variables
		var template = this._getTemplate();
		var hasMarkup = (this.options.html || ( this.options.url && template ) );
		var hasData = (this.options.data && ( _.isUndefined( this.data.toJSON ) || ( !_.isUndefined( this.data.toJSON ) && !_.isEmpty(this.data.toJSON()))));
		// if there's data and markup available, render
		if( hasMarkup && hasData ) return true;
		// if there's only one or the other render
		if( hasMarkup && !this.options.data) return true;
		if( hasData && !this.options.url ) return true;
		// in all other cases, don't render
		return false;
	}

	_preRender(){
		// app-specific actions
		this.preRender();
	}

	_postRender(){
		// make sure the container is presented
		if( !this.options.silentRender ) this.el.style.display = 'block';
		// remove loading state (if data has arrived)
		if( !this.options.data || (this.options.data && !_.isEmpty(this._toJSON()) ) ){
			this.el.classList.remove("loading");
			// set the appropriate flag
			this.state.set("loaded", true);
			// bubble up the event
			this.trigger("loaded");
		}
		// app-specific actions
		this.postRender();
	}

	// get the JSON of the data
	_toJSON(){
		if( !this.options.data ) return {};
		if( this.data.toJSON ) return this.data.toJSON();
		return this.data; // in case the data is a JSON...
	}

	_getTemplate(){
		return ( this.options.type ) ? this.template.get( this.options.type ) : this.template;
	}

	_onLoaded(){
		this.setElement( this.el );
	}

	// - container is defined in three ways
	// * renderTarget is the element
	// * renderTarget inside the element
	// * renderTarget outside the element (bad practice?)
	_findContainer(){
		// by default
		var container = this.el;

		if ( !this.options.renderTarget ){
			// do nothing more

		} else if( typeof this.options.renderTarget == "string" ){

			container = this.el.querySelectorAll(this.options.renderTarget)[0];
			if( !container.length ){
				// assume this always exists...
				container = document.querySelector(this.options.renderTarget);
			}

		} else if( typeof this.options.renderTarget == "object" ){

			container = this.options.renderTarget;

		}

		return container;

	}

	// checks if an element exists in the DOM
	_inDOM( el ){
		// fallbacks
		el = el || this.el;
		// prerequisites
		if( !el ) return false;
		// variables
		var exists = false;
		var parent = document.querySelector( (this.options.parentEl || "body") );
		// check parent element
		exists = parent.contains( el );
		if( exists ) return true;
		// el not in parent el
		if( this.options.parentPrepend ){
			parent.prepend( el );
		} else {
			parent.append( el );
		}
	}

	// - When navigate is triggered
	_navigate( e ){
		// extend method with custom logic
	}

	// resize event trigger (with debouncer)
	_resize () {
		var self = this ,
		args = arguments,
		timeout,
		delay = 1000; // default delay set to a second
		clearTimeout( timeout );
		timeout = setTimeout( function () {
			self.resize.apply( self , Array.prototype.slice.call( args ) );
		} , delay);
	}

	//
	_scroll() {
		//this.state.set("scroll", true);
	}

	// checks if the view is visible
	isVisible(){

		var viewportWidth = jQuery(window).width(),
			viewportHeight = jQuery(window).height(),

			documentScrollTop = jQuery(document).scrollTop(),
			documentScrollLeft = jQuery(document).scrollLeft(),

			minTop = documentScrollTop,
			maxTop = documentScrollTop + viewportHeight,
			minLeft = documentScrollLeft,
			maxLeft = documentScrollLeft + viewportWidth,

			$el = $(this.el),
			elementOffset = $el.offset();
		// condition
		var visible = ( (elementOffset.top >= minTop && elementOffset.top < maxTop) && (elementOffset.left >= minLeft && elementOffset.left < maxLeft) );
		// trigger state if needed
		if( visible && !this.state.get("visible") ){
			this.trigger("visible");
		} else {
			this.trigger("hidden");
		}
		// save state for later...
		this.state.set("visible", visible);

		return visible;
	}

}


class Layout extends View {

	constructor( options ) {

		this.el = "body";
		// defaults
		this.defaults = {
			autosync : false,
			autorender: true,
			sync_events: "add remove change"
		};

		// events
		this.events = {
			"click a:not([rel='external'],[rel='alternate'])" : "_clickLink"
		};

		// fallback
		options = options || {};
		// #39 - backbone > 1.0 does not extend options automatically... (condition this?)
		this.options = _.extend({}, this.defaults, options);

		this.cid = _.uniqueId("layout");

		this.initialize();

	}

	initialize(){
		// containers
		this.views = new Model();

		// unbind this container from any previous listeners
		$(this.el).unbind();
		// bind event to this object
		_.bindAll(this, "set", "get", "render", "update", "_clickLink", "_viewLoaded", "_syncData");
		this.on("update", this.update);

		// #77 using url option to compile template
		if( this.options.url || this.url ){
			var url = this.options.url || this.url;
			// set the type to default (as the Template expects)
			if( !this.options.type ) this.options.type = "default";
			this.template = new Template(null, { url : url });
			if( this.options.autorender ) this.template.bind("loaded", this.render);
		}
		// saving data
		if( options.data ) this.data = options.data;

		// initiate parent
		//return View.prototype.initialize.call( this, options );
	}

	preRender(){

	}

	render(){
		this._preRender();
		// remove loading class (if any)
		$(this.el).removeClass("loading");

		// creating html if required
		if( this.template ){
			var template = ( this.options.type ) ? this.template.get( this.options.type ) : this.template;
			// use the options as data..
			var html = template( this.options );
			$(this.el).html( html );
		}

		this._postRender();
	}

	postRender(){
	}

	update( e ){
		e = e || false;
		// if there's no event exit?
		if( !e ) return;
		// broadcast the event to the views...
		// - if there's rerouting:
		if( e.navigate ){
			// better way to get views?
			for( var i in this.views.attributes){
				this.views.attributes[i]._navigate(e);
			}
		}
		// - include other conditions...
	}

	// setter and getter mirroring the Model methods
	set( views ){
		// add event triggers on the views
		for( var i in views){
			views[i].on("loaded", _.bind( this._viewLoaded, this ) );
			// 'stamp' each view with a label
			views[i]._name = i;
			// bind events
			if( views[i].data ) {
				// view reference in the data
				views[i].data._view = i;
				// bind all data updates to the layout
				views[i].data.on(this.options.sync_events, _.bind(this._syncData, this) );
			}
		}
		return this.views.set( views );
	}

	get( view ){
		return this.views.get( view );
	}

	// removes a view
	remove( name ){
		//console.log("unset", name);
		var view = this.get( name );
		// prerequisite
		if( _.isUndefined(view) ) return;
		// undelegate view events
		view.remove();
		// remove the attribute from this.views
		return this.views.unset( name );
	}

	findLink( target ) {
		var $el = (target.tagName != "A") ? $(target).closest("a") : $(target);
		var url = $el.attr("href");
		// filter some URLs
		// - defining local URLs
		var isLocal = (url) ? ( url.substr(0,1) == "#" || (url.substr(0,2) == "/#" && window.location.pathname == "/" ) ) : false;
		return ( _.isEmpty(url) || isLocal || $el.attr("target") ) ? false : url;
	}

	// Internal methods
	_preRender(){
		// add touch class to body
		if( app.state.touch ) $(this.el).addClass("touch");
		// app-specific actions
		this.preRender();
	}

	_postRender(){
		// app-specific actions
		this.postRender();
	}

	_viewLoaded(){
		var registered = 0,
			loaded = 0;
		// check if all the views are loaded
		_.each(this.views.attributes, function( view ){
			if( view.state.loaded ) loaded++;
			registered++;
		});

		// when all views are loaded...
		if( registered == loaded ){
			this._allViewsLoaded();
		}

	}

	// what to do after all views are loaded
	_allViewsLoaded(){
		return _.once(function(){
			// re-render the layout
			this.render();
		});
	}

	// broadcast all data updates in the views back to the layout
	//_syncData: function( action, model, collection, options ){
	_syncData( model, collection, options ){
		var value = false;
		// fallback
		var data = collection || model || false;
		if( !data ) return;
		// get the key of the data
		var key = data._view || false;
		// if we haven't kept a reference key to backtrack, exit now
		if( !key ) return;
		// this automation only works when the original data is a Backbone.Model
		if( this.model instanceof Backbone.Model ){
			var keys = this.model.keys() || [];
			// this only works if there's existing data
			if( keys.indexOf( key ) == -1 ) return;
			// get the data in an exported form (usually toJSON is enough)
			try{
				value = data.output();
			} catch( e ){
				// assume this collection is generic
				value = data.toJSON();
			}
			// final condition...
			if( value ){
				var attr = {};
				attr[key] = value;
				this.model.set( attr );
				// immediately save?
				if (this.options.autosync){
					this.model.save();
				}
			}
		}
	}

	_clickLink( e ){
		var url = this.findLink(e.target);
		if( url ){
			// add loading class
			$(this.el).addClass("loading");
		}
		// when to intercept links
		if( app.state.standalone() && url ){
				// block default behavior
				e.preventDefault();
				//
				window.location = url;
				return false;
		}
		// otherwise pass through...
	}

}

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


class Template extends Model {

	constructor( html, options ) {
		// fallback(s)
		options = options || (options={});
		html = html || "";
		//
		super(options);

		this.html = html;

		this.cid = _.uniqueId("template");

		this.initialize();
	}

	initialize(){
		_.bindAll(this, 'fetch', 'parse');
		// fallback for options
		var html = this.html;

		if( !_.isEmpty(html) ){
			this.set( "default", this.compile( html ) );
			this.trigger("loaded");
		}
		//if( !_.isUndefined( options.url ) && !_.isEmpty( options.url ) ){
		if( this.options.url ){
			this.url = this.options.url;
			this.fetch();
		}
	}

	compile( markup ){

		var cleanMarkup = this._sanitize( markup );

		// escape single quotes so they don't escape the next function prematurely
		cleanMarkup = cleanMarkup.replace(/`/g, '\\`');
		// main function
		var template = function( data ){

			const keys = Object.keys( data );
			const fn = new Function(...keys, 'return `' + cleanMarkup + '`');

			return fn(...keys.map(key => data[key]));
		};

		//template.bind( this );

		return template;
	}

	fetch(){
		// this can be replaced with a backbone method...
		$.get(this.url, this.parse);
	}

	parse( data ){
		var self = this;
		var scripts;
		try{
			scripts = $(data).filter("script");
		} catch( e){
			// can't parse this - probly not html...
			scripts = [];
		}
		// check if there are script tags
		if( !scripts.length ){
			// save everything in the default attr
			this.set( "default", self.compile( data ) );
		} else {
			// loop through the scripts
			scripts.each(function(){
				// filter only scripts defined as template
				var el = $(this);
				if(el.attr("type").indexOf("template") >= 0){
					// convention: the id sets the key for the template
					self.set( el.attr("id"), self.compile( el.html() ) );
				}
			});
		}
		this.trigger("loaded");
		//return data;
	}

	// internal methods
	_sanitize( html ) {
		// prerequisites
		if( !_.isString(html) ) return false;
		// variables
		const replaceTags = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'(': '%28',
			')': '%29'
		};

		const output = text => text.toString().replace(/[&<>\(\)]/g, tag =>
		replaceTags[tag] || tag);

		return output;
	}

	/*
	Fallbacks
	} else if( url ) {
		// fallback to the underscore template
		$.get(url, function( html ){
			self.template = _.template( html );
			if( self.options.autoRender ) self.render();
		});
	} else {
		this.template = _.template( html );
		if( self.options.autoRender ) this.render();
	}
	*/

}

// utilities
class Utils {

	constructor() {

		// Helpers
		// this is to enable {{moustache}} syntax to simple _.template() calls
		this.templateSettings = {
			interpolate : /\{\{(.+?)\}\}/g,
			variable : "."
		};

		// if available, use the Handlebars compiler
		if(typeof Handlebars != "undefined"){
			_.mixin({
				template : Handlebars.compile
			});
		}

	}

	// Common.js extend method: https://github.com/commons/common.js
	extend(){
		var objects = Array.prototype.slice.call( arguments ); // to array?
		var destination = {};
		for( var obj in objects ){
			var source = objects[obj];
			for (var property in source){
				if (source[property] && source[property].constructor && source[property].constructor === Object) {
					destination[property] = destination[property] || {};
					destination[property] = _.extend.caller(destination[property], source[property]);
				} else {
					destination[property] = source[property];
				}
			}
		}
		return destination;
	}

	uuid(){
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
			return v.toString(16);
		});
	}

	// - Support Phonegap Shim: https://github.com/makesites/phonegap-shim
	isPhonegap(){
		// only execute in app mode?
		return typeof PhoneGap != "undefined" && typeof PhoneGap.init != "undefined" && typeof PhoneGap.env != "undefined"  && PhoneGap.env.app;
	}

/*
	isUndefined( obj ){
		return (typeof obj == "undefined");
	}
*/

	// Source: https://www.30secondsofcode.org/js/s/bind-all/
	bindAll( context, ...methods ){
		methods.forEach(function( fn ){
			let f = context[fn];
			context[fn] = function() {
				return f.apply(context);
			};
		});
	}

	// Source: https://locutus.io/php/var/empty/
	isEmpty( mixedVar ){
		let undef;
		let key;
		let i;
		let len;
		const emptyValues = [undef, null, false, 0, '', '0'];
		for (i = 0, len = emptyValues.length; i < len; i++) {
			if (mixedVar === emptyValues[i]) {
				return true;
			}
		}
		if (typeof mixedVar === 'object') {
			for (key in mixedVar) {
				if (mixedVar.hasOwnProperty(key)) {
					return false;
				}
			}
			return true;
		}
		return false;
	}

	isString( v ){
		return (typeof v == "string");
	}

	getSiblings (elem) {

		// Setup siblings array and get the first sibling
		var siblings = [];
		var sibling = elem.parentNode.firstChild;

		// Loop through each sibling and push to the array
		while (sibling) {
			if (sibling.nodeType === 1 && sibling !== elem) {
				siblings.push(sibling);
			}
			sibling = sibling.nextSibling;
		}

		return siblings;

	}

	// Based on uniqueCode.js (with a prefix)
	// Source: https://gist.github.com/tracend/8203090
	uniqueId( prefix ){
		// fallback
		prefix = prefix+"-" || "";
		// variables
		var characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
		var ticks = (new Date()).getTime().toString();
		var code = "";
		for (var i = 0; i < characters.length; i += 2) {
			if ((i + 2) <= ticks.length) {
				var number = parseInt(ticks.substr(i, 2));
				if (number > characters.length - 1) {
					var one = number.toString().substr(0, 1);
					var two = number.toString().substr(1, 1);
					code += characters[parseInt(one)];
					code += characters[parseInt(two)];
				} else {
					code += characters[number];
				}
			}
		}
		return prefix + code;
	}


	// ---
	// Underscore.js methods
	// Source: http://underscorejs.org/

	isNull(obj) {
		return obj === null;
	}

	isUndefined( obj ){
		return obj === void 0;
	}

	// Traverses the children of `obj` along `path`. If a child is a function, it
	// is invoked with its parent as context. Returns the value of the final
	// child, or `fallback` if any child is undefined.
	result( obj, path, fallback ){
		path = ( Array.isArray(path) ) ? path : [path];
		var length = path.length;
		if (!length) {
			return (typeof fallback === 'function') ? fallback.call(obj) : fallback;
		}
		for (var i = 0; i < length; i++) {
			var prop = obj == null ? void 0 : obj[path[i]];
			if (prop === void 0) {
				prop = fallback;
				i = length; // Ensure we don't continue iterating.
			}
			obj = (typeof prop === 'function') ? prop.call(obj) : prop;
		}
		return obj;
	}

}


//import { Model } from "./model.js";
//import { View } from "./view.js";
//import { Controller } from "./controller.js";
//import { Collection } from "./collection.js";
//import { Layout } from "./layout.js";

// Namespace definition
class APP {

	constructor() {

		this.name = 'APP';

		// internal
		this._routes = [];

		// get config
		var options = arguments[0] || {};
		var callback = arguments[1] || function(){};
		// defaults
		options.require = options.require || (typeof define === 'function' && define.amd);
		options.routePath = "app/controllers/";
		options.pushState = options.pushState || false;

		// save options
		this.options = options;

		// legacy
		this.Routers = this.Controllers;

		// find controller
		var controller = false;
		// check URIs
		var path = window.location.pathname.split( '/' );
		// FIX: discart the first item if it's empty
		if ( path[0] === "" ) path.shift();
		// default router
		var controllerDefault = options.routePath +"default";
		if(typeof options.require == "string"){
			controller = options.require;
		} else {
			controller = options.routePath;
			controller += ( !_.isEmpty(path[0]) ) ? path[0] : "default";
		}
		if( options.require ){
			// use require.js
			require( [ controller ], function( controller ){
				if( controller ){
					callback( controller );
				}
			}, function (err) {
				//The errback, error callback
				//The error has a list of modules that failed
				var failed = err.requireModules && err.requireModules[0];
				// what if there's no controller???
				if( failed == controller ){
					// fallback to the default controller
					require( [ controllerDefault ], function( controller ){
						callback( controller );
					});
				} else {
					//Some other error. Maybe show message to the user.
					throw err;
				}
			});

			return APP;

		} else {
			// use config to get list of available options
			var list = options.controllers || [];
			var route = ( !_.isEmpty(path[0]) ) ? path[0] : "default";

			if( list.includes(route) ){
				import("../"+ controller+'.js').then(module => {
					// Use the imported module here
					var ucRoute = route.charAt(0).toUpperCase() + route.slice(1);
					var Router = (typeof module[ucRoute] === "function") ? module[ucRoute] : module.Router; // more fallbacks
					this.route = new Router();
				}).catch(error => {
					// Handle errors here
					console.error(error);
				});
			} else if( list.includes("default") ){
				import( "../"+ controllerDefault+'.js').then(module => {
					// Use the imported module here
					var Router = (typeof module.Default === "function") ? module.Default : module.Router; // more fallbacks
					this.route = new Router();
				}).catch(error => {
					// Handle errors here
					console.error(error);
				});
				// check if there's a custom default controller
				//import * as CustomRouter from controllerDefault+".js";
				//this.route = new CustomRouter();
			} else {
				// fallback to the default router
				this.route = new APP.Controller();
			}

			// return controller so it's accessible through the app global
			return this.route;
		}
		// OLD version: global namespace lookup
		/*
		} else {
			// default controller
			var defaultController = (APP.Controllers.Default) ? APP.Controllers.Default : Controller;
			// find a controller based on the path
			for(var i in path ){
				// discart the first item if it's empty
				if( path[i] === "") continue;
				controller = (path[i].charAt(0).toUpperCase() + path[i].slice(1));
				// stop if we've found a controller
				if(typeof(APP.Controllers[controller]) == "function") break;
			}
			// call the controller or fallback to the default
			var route = (controller && APP.Controllers[controller]) ? new APP.Controllers[controller]( options ) : new defaultController( options );
			// return controller so it's accessible through the app global
			return route;
		}
		*/

	}

	routes() {
		return this._routes;
	}

	/*
	 * based on Backbone.ready()
	 * Source: https://gist.github.com/tracend/5617079
	 *
	 * by Makis Tracend( @tracend )
	 *
	 * Usage:
	 * APP.ready( callback );
	 *
	 */
	ready( callback ){

		if( _.isPhonegap() ){
			return PhoneGap.init( callback );

		} else if( $ ) {
			// use the 'default' ready event
			return $(document).ready( callback );

		} else if (window.addEventListener) {
			// ultimate fallback, add window event - trigger the page as soon it's loaded
			return window.addEventListener('load', callback, false);

		} else {
			// IE...
			return window.attachEvent('onload', callback);
		}

	}

}



// Base Classes
APP.Model = Model;
APP.View = View;
APP.Controller = Controller;
APP.Template = Template;
APP.Collection = Collection;
APP.Layout = Layout;

// Namespace containers
APP.Models = {};
APP.Controllers = {};
APP.Collections = {};
APP.Views = {};
APP.Layouts = {};
APP.Templates = {};


// Initialize utilities
// convention carried from the legacy underscore.js
var _ = new Utils();

if ( window ) window.APP = APP;

export { APP, Collection, Controller, Layout, Model, Template, View };
