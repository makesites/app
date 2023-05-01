/**
 * @name app
 * 
 *
 * Version: 0.4.0 (Mon, 01 May 2023 04:50:14 GMT)
 * Source: 
 *
 * @author makesites
 * Distributed by [Makesites.org](http://makesites.org)
 *
 * @license Released under the MPL v2.0, AGPL v3.0 licenses
 */

//import { APP } from "./app.js";



class Collection {

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
		this.options = utils.extend( {}, this.defaults, options );
		//this.options = _.extend({}, this.defaults, options);
		//...

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
		this.options = utils.extend({}, this.defaults, options);

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


class Model {

	constructor( model, options ) {

		this.defaults = {
			autofetch: false,
			cache: false
		};

		// save options for later
		options = options || {};
		this.options = utils.extend({}, this.defaults, options);
		//this.options = _.extend({}, this.defaults, options);

		this.initialize();
	}

	// initialization
	initialize(){
		// set data if given
		//if( !_.isNull( model ) && !_.isEmpty( model ) ) this.set( model );
		if( typeof model == "object" ) this.set( model );
		// restore cache
		if( this.options.cache ){
			var cache = this.cache();
			if( cache ) this.set( cache );
		}
		// auto-fetch if no models are passed
		//if( this.options.autofetch && !_.isUndefined(this.url) ){
		if( this.options.autofetch && !utils.isUndefined(this.url) ){
				this.fetch();
		}
	}

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

	// #63 reset model to its default values
	reset(){
		return this.clear().set(this.defaults);
	}

	// Use cache, if available
	cache(){
		// optionally create your own custom a cache mechanism...
		return ( Model.cache ) ? Model.cache() : false;
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

	// extract data (and possibly filter keys)
	output(){
		// in most cases it's a straight JSON output
		return this.toJSON();
	}

}


class View {

	constructor( options ){
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
			renderTarget: false,
			saveOptions: true // eventually disable this (test first)
		};
		// events
		this.events = {
			"click a[rel='external']" : "clickExternal"
		};

		// fallback
		options = options || {};
		//  extend options
		//this.options = _.extend({}, this.defaults, options);
		this.options = utils.extend({}, this.defaults, options);

		this.initialize();
	}

	initialize(){
		var self = this;
		// unbind this container from any previous listeners
		$(this.el).unbind();
		//
		//_.bindAll(this, 'render', 'clickExternal', 'postRender', 'onLoaded', '_url', '_inDOM', '_toJSON', '_onLoaded');
		//if( typeof this.url == "function" ) _.bindAll(this, 'url');
		// #73 - optionally saving options
		if( this.options.saveOptions ) this.options = _.extend(this.options, options);
		// find the data
		this.data = this.data || this.model || this.collection || null;
		this.options.data  = !_.isNull( this.data );
		//
		this.on('loaded', this.onLoaded );
		this.on('loaded', this._onLoaded );


		// #9 optionally add a reference to the view in the container
		if( this.options.attr ) {
			$(this.el).attr("data-view", this.options.attr );
		} else {
			$(this.el).removeAttr("data-view");
		}
		// compile
		var html = ( this.options.html ) ? this.options.html : null;
		// #18 - supporting custom templates
		var Template = (this.options.template || typeof APP == "undefined") ? this.options.template : (APP.Template || false);
		// #76 considering url as a flat option
		if( this.url && !this.options.url) this.options.url = this.url; // check for string?
		// #72 - include init options in url()
		var url = this._url( options );
		// proxy internal method for future requests
		this.url = this._url;

		if( Template ) {
			// set the type to default (as the Template expects)
			if( !this.options.type ) this.options.type = "default";
			this.template = (typeof Template == "function") ? new Template(html, { url : url }) : Template;
			if( self.options.autoRender ) this.template.bind("loaded", this.render);
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
		$(window).bind("resize", _.bind(this._resize, this));

		this.initStates();
		// initiate parent (states etc.)
		//return Backbone.View.prototype.initialize.call( this, options );
		//return View.prototype.initialize.call(this, options);
	}

	initStates(){
		for(var e in this.states){
			var method = this.states[e];
			this.bind(e, _.bind(this[method], this) );
		}
	}

	// #71 parse URL in runtime (optionally)
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
		// #19 - checking instance of template before executing as a function
		var html = ( template instanceof Function ) ? template( data ) : template;
		var $el;
		// #64 find the render target
		var $container = this._findContainer();
		// saving element reference
		if( !this.el ){
			$el = $( html );
			this.el = this.$el = $el;
		}
		// make sure the element is attached to the DOM
		this._inDOM();
		// ways to insert the markup
		if( this.options.append ){
			$el = $el || $( html );
			$container.append( $el );
		} else if( this.options.prepend ){
			$el = $el || $( html );
			$container.prepend( $el );
		} else {
			$container.html( html );
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
		var section = this.findLink(e.target);
		$(this.el).find( section ).show().siblings().hide();
		// optionally add selected class if li available
		$(e.target).parent("li").addClass("selected").siblings().removeClass("selected");
	}

	findLink(obj) {
		if (obj.tagName != "A") {
			return $(obj).closest("a").attr("href");
		} else {
			return $(obj).attr("href");
		}
	}

	remove() {
		// unbind the namespaced
		$(window).unbind("resize", this._resize);

		// don't forget to call the original remove() function
		Backbone.View.prototype.remove.call(this);
	}

	unbind( types, fn ) {
		return this.off( types, null, fn );
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
		if( !this.options.silentRender ) $(this.el).show();
		// remove loading state (if data has arrived)
		if( !this.options.data || (this.options.data && !_.isEmpty(this._toJSON()) ) ){
			$(this.el).removeClass("loading");
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

			container = $(this.el).find(this.options.renderTarget).first();
			if( !container.length ){
				container = $(this.options.renderTarget).first(); // assume this always exists...
			}

		} else if( typeof this.options.renderTarget == "object" ){

			container = this.options.renderTarget;

		}

		// convert into a jQuery object if needed
		return ( container instanceof jQuery) ? container : $(container);

	}

	// checks if an element exists in the DOM
	_inDOM( $el ){
		// fallbacks
		$el = $el || this.$el;
		// prerequisites
		if( !$el ) return false;
		// variables
		var exists = false;
		var parent = this.options.parentEl || "body";
		// check parent element
		exists = $(this.options.parentEl).find( $el ).length;
		if( exists ) return true;
		// el not in parent el
		if( this.options.parentPrepend ){
			$(parent).prepend( $el );
		} else {
			$(parent).append( $el );
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
			this.template = new APP.Template(null, { url : url });
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


class Template extends Model {

	constructor( html, options ) {
		this.initialize();
	}

	initialize(){
		_.bindAll(this, 'fetch', 'parse');
		// fallback for options
		var opt = options || (options={});

		if( !_.isEmpty(html) ){
			this.set( "default", this.compile( html ) );
			this.trigger("loaded");
		}
		//if( !_.isUndefined( options.url ) && !_.isEmpty( options.url ) ){
		if( options.url ){
			this.url = options.url;
			this.fetch();
		}
	}

	compile( markup ){
		return _.template( markup );
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
					// convention: the id sets the key for the tmeplate
					self.set( el.attr("id"), self.compile( el.html() ) );
				}
			});
		}
		this.trigger("loaded");
		//return data;
	}

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
					destination[property] = utils.extend.caller(destination[property], source[property]);
				} else {
					destination[property] = source[property];
				}
			}
		}
		return destination;
	}

	// - Support Phonegap Shim: https://github.com/makesites/phonegap-shim
	isPhonegap(){
		// only execute in app mode?
		return typeof PhoneGap != "undefined" && typeof PhoneGap.init != "undefined" && typeof PhoneGap.env != "undefined"  && PhoneGap.env.app;
	}

	isUndefined( obj ){
		return (typeof obj == "undefined");
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

		// Namespace containers
		this.Models = {};
		this.Controllers = {};
		this.Collections = {};
		this.Views = {};
		this.Layouts = {};
		this.Templates = {};

		// get config
		var options = arguments[0] || {};
		var callback = arguments[1] || function(){};
		// defaults
		options.require = options.require || (typeof define === 'function' && define.amd);
		options.routePath = "app/controllers/";
		options.pushState = options.pushState || false;
		// find controller
		var controller = false;
		// check URIs
		var path = window.location.pathname.split( '/' );
		// FIX: discart the first item if it's empty
		if ( path[0] === "" ) path.shift();
		//
		if( options.require ){
			// use require.js
			var controllerDefault = options.routePath +"default";
			if(typeof options.require == "string"){
				controller = options.require;
			} else {
				controller = options.routePath;
				controller += ( !_.isEmpty(path[0]) ) ? path[0] : "default";
			}
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
			// find a controller based on the path
			for(var i in path ){
				// discart the first item if it's empty
				if( path[i] === "") continue;
				controller = (path[i].charAt(0).toUpperCase() + path[i].slice(1));
				// stop if we've found a controller
				if(typeof(this.Controllers[controller]) == "function") break;
			}
			// call the controller or fallback to the default
			var route = (controller && this.Controllers[controller]) ? new this.Controllers[controller]( options ) : new Controller( options );
			// return controller so it's accessible through the app global
			return route;
		}


		// legacy
		this.Routers = this.Controllers;
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

		if( utils.isPhonegap() ){
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
APP.Collection = Collection;
APP.Layout = Layout;



var utils = new Utils();

if ( window ) window.APP = APP;

export { APP, Collection, Controller, Layout, Model, Template, View };
