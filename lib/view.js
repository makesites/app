import { Base } from "./base.js";
import { Model } from "./model.js";
import { Template } from "./template.js";
import { _ } from "./utils.js";

// One window "resize" listener for every View, instead of one per instance.
// A list of 500 rows used to register 500 listeners; now it registers none,
// because the base resize() is a no-op and only views that actually override it
// are watched at all.
var resizeTargets = new Set();
var resizeListener = null;
var resizeWindow = null;

function watchResize( view ){
	if( typeof window === "undefined" ) return;
	resizeTargets.add( view );
	// already listening on this window
	if( resizeListener && resizeWindow === window ) return;
	// the window changed under us (test harnesses swap it; a browser never does)
	if( resizeListener && resizeWindow ) resizeWindow.removeEventListener( "resize", resizeListener );
	resizeListener = function( e ){
		resizeTargets.forEach(function( target ){
			// skip views that never overrode resize() - the base one is a no-op, so
			// waking them would only schedule a debounce timer to call nothing.
			// Checked here rather than at registration so a resize handler assigned
			// after construction still works.
			if( target.resize === View.prototype.resize ) return;
			target._resize( e );
		});
	};
	resizeWindow = window;
	resizeWindow.addEventListener( "resize", resizeListener );
}

function unwatchResize( view ){
	resizeTargets.delete( view );
	if( resizeTargets.size || !resizeListener ) return;
	if( resizeWindow ) resizeWindow.removeEventListener( "resize", resizeListener );
	resizeListener = null;
	resizeWindow = null;
}

class View extends Base {

	/**
	 * @param {Object} [options] - { el, model, collection, data, html, url, template, ... }
	 */
	constructor( options ){
		// fallback(s)
		options = options || {};
		//
		super( options );
		// element
		this.el = this._getEl( options );
		// data sources. The Backbone-style `model` / `collection` options were
		// read here but never assigned, so `this.model` was always undefined:
		// `new View({ model })` bound to nothing and `this.model.get(...)` inside
		// a subclass render() threw. Assign them (skipping any subclass accessor,
		// which cannot be written to), then resolve `data` as before.
		if( options.model && _.assignable( this, 'model' ) ) this.model = options.model;
		if( options.collection && _.assignable( this, 'collection' ) ) this.collection = options.collection;
		this.data = options.data || this.model || this.collection || null;
		// `state` is created on first access (see the accessor below) rather than
		// here, so a view that never renders never allocates a Model for it.
		// built-in state machine + events. Kept as _base* so they merge with a
		// subclass's states/events (getter or property) without being clobbered -
		// and so subclass getters don't collide with a constructor assignment.
		this._baseStates = {
			"scroll": "_scroll"
		};
		this._baseEvents = {
			"click a[rel='external']" : "clickExternal"
		};

		// view option defaults (a subclass may override via get defaults())
		var defaults = _.extend({}, this._viewDefaults(), _.result(this, 'defaults'));

		//  extend options
		this.options = _.extend({}, defaults, options);
		// flags
		// whether a data source was resolved. This used to be written back over
		// `options.data` - the very option the caller passes a model/collection in -
		// so the same key meant a source going in and a boolean coming out. The flag
		// now has its own name and `options.data` keeps what was passed.
		this.options.hasData = !_.isNull( this.data );

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
			this.el.setAttribute("data-view", this.options.attr );
		} else {
			this.el.removeAttribute("data-view");
		}
		// compile
		var html = ( this.options.html ) ? this.options.html : null;
		// considering url as a flat option (check for string?)
		if( this.url && !this.options.url) this.options.url = this.url;
		// include init options in url()
		var url = this._url( this.options );
		// proxy internal method for future requests - unless the subclass declared
		// its own `url` accessor, which cannot be assigned over
		if( _.assignable( this, 'url' ) ) this.url = this._url;
		// set the type to default (as the Template expects)
		if( !this.options.type ) this.options.type = "default";
		// Only build a Template when there is something for it to do. Every view
		// used to get one even with no `html` and no `url` - 500 list rows meant
		// 500 Template instances that compiled nothing.
		if( html || url || this.options.template ){
			let TMPL = ( this.options.template ) ? this.options.template : Template;
			this.template = (typeof TMPL == "function") ? new TMPL(html, { url : url }) : TMPL;
			// re-render when the template loads (tracked so remove() cleans it up)
			if( self.options.autoRender && this.template.on ) this.listenTo(this.template, "loaded", this.render);
		} else {
			this.template = null;
		}

		// add listeners (tracked via listenTo so remove() tears them down)
		if( this.options.hasData && !_.isUndefined( this.data.on ) ){
			this.listenTo( this.data, this.options.bind, this.render );
		}
		// #11 : initial render only if data is not empty (or there are no data)
		if( this._initRender() ){
			this.render();
		} else {
			this.trigger("loaded");
		}
		// #36 - resize handling, through the shared listener. Registration is just a
		// Set entry; whether this view is actually woken is decided at dispatch.
		watchResize( this );
		// Visibility is observed lazily - see isVisible() / on(). Creating an
		// IntersectionObserver per view up front was the single biggest per-instance
		// cost, and most views never ask about visibility at all.

		this.initStates();
		// initiate parent (states etc.)
		//return Backbone.View.prototype.initialize.call( this, options );
		//return View.prototype.initialize.call(this, options);
	}

	// The view's state Model, created on demand. Most of the lifecycle touches it
	// (render sets `loaded`), but a view that is constructed and never rendered -
	// or one that only ever has its own render() called - no longer pays for it.
	get state(){
		if( !this._state ){
			this._state = new Model();
			this._state.set({ loaded: false, scroll: false, visible: false });
		}
		return this._state;
	}
	set state( value ){
		this._state = value;
	}

	// built-in view option defaults (merged under any subclass get defaults()).
	// initStates() is now inherited from Base (resolve-merge of _baseStates).
	_viewDefaults(){
		return {
			data : false,
			html: false,
			template: false,
			url : false,
			bind: "add remove reset change",
			type: false,
			parentEl : false,
			autoRender: true,
			inRender: false,
			silentRender: false,
			renderTarget: false,
			resizeDelay: 1000
		};
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

	/**
	 * Render the view's template into its element (or renderTarget). Override for
	 * custom rendering.
	 * @returns {void}
	 */
	render(){
		// execute pre-render actions
		this._preRender();
		//
		var template = this._getTemplate();
		var data = this.toJSON();
		// checking instance of template before executing as a function
		var html = ( template instanceof Function ) ? template( data ) : template;
		// nothing compiled yet (no `html` / `url` option) - there is no markup to
		// insert, and blanking the element would destroy its existing content.
		// Subclasses that override render() are unaffected.
		if( html == null ) return this._postRender();
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

		//container.attachShadow({ mode: 'open'}).appendChild(template.content.cloneNode(true))
		// execute post-render actions

		this._postRender();
	}

	postRender(){
	}

	// a more discrete way of binding events triggers to objects
	listen( obj, event, callback ){
		// adds event listeners to the data (tracked via listenTo for cleanup)
		var e = ( typeof event == "string")? [event] : event;
		for( var i in e ){
			this.listenTo(obj, e[i], callback);
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
		var siblings = _.getSiblings( sectionEl );
		siblings.forEach( (sibling) => (sibling.style.display = 'none') );
		// optionally add selected class if the link sits in a list item
		var li = e.target.closest("li");
		if( li ){
			li.classList.add("selected");
			_.getSiblings( li ).forEach( function( sibling ){ sibling.classList.remove("selected"); });
		}
	}

	findLink(obj) {
		if (obj.tagName != "A") {
			var link = obj.closest("a");
			return link ? link.getAttribute("href") : null;
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

	// Resolve the view's element: an `el` option (an element or a selector), or
	// a new one built from the Backbone-style declarations.
	//
	// `tagName` / `className` / `id` / `attributes` were accepted nowhere before:
	// a view without an `el` always got a bare `<div>`, so
	// `new View({ tagName: "li", className: "card" })` silently produced the wrong
	// element. They may be passed as options or declared on the subclass (they are
	// only ever read, so a getter or a function is fine - `attributes` as a
	// function is the Backbone idiom).
	_getEl( options ){
		var el = options.el;
		// a selector resolves against the document
		if( typeof el === "string" ) el = document.querySelector( el );
		if( el ) return el;

		var tagName = options.tagName || _.result( this, "tagName" ) || "div";
		el = document.createElement( tagName );

		var attributes = _.extend( {}, _.result( this, "attributes" ), options.attributes );
		var className = options.className || _.result( this, "className" );
		var id = options.id || _.result( this, "id" );
		if( className ) attributes["class"] = className;
		if( id ) attributes.id = id;

		for( var key in attributes ){
			if( attributes[key] != null ) el.setAttribute( key, attributes[key] );
		}
		return el;
	}


	// - render

	_initRender(){
		if( !this.options.autoRender ) return false;
		// variables
		var template = this._getTemplate();
		var hasMarkup = (this.options.html || ( this.options.url && template ) );
		var hasData = (this.options.hasData && ( _.isUndefined( this.data.toJSON ) || ( !_.isUndefined( this.data.toJSON ) && !_.isEmpty(this.data.toJSON()))));
		// if there's data and markup available, render
		if( hasMarkup && hasData ) return true;
		// if there's only one or the other render
		if( hasMarkup && !this.options.hasData) return true;
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
		if( !this.options.hasData || (this.options.hasData && !_.isEmpty(this._toJSON()) ) ){
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
		if( !this.options.hasData ) return {};
		if( this.data.toJSON ) return this.data.toJSON();
		return this.data; // in case the data is a JSON...
	}

	_getTemplate(){
		// null when no markup was supplied (the Template is built lazily)
		if( !this.template ) return undefined;
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
		var target = this.options.renderTarget;
		// by default the view renders into its own element
		if( !target ) return this.el;
		// an element was handed in directly
		if( typeof target !== "string" ) return target;
		// a selector: prefer a match inside the view's element, then fall back to
		// the document.
		//
		// (The previous version tested `container.length` on the *Element*
		// returned by querySelectorAll(...)[0]. An Element has no `length`, so an
		// in-element match was always discarded in favour of the document-wide
		// lookup - the documented "renderTarget inside the element" case never
		// worked - and a miss threw `Cannot read properties of undefined`.)
		var container = this.el ? this.el.querySelector( target ) : null;
		if( !container && typeof document !== "undefined" ) container = document.querySelector( target );
		// nothing matched anywhere: render into the view's own element rather
		// than throwing out of render()
		return container || this.el;
	}

	// checks if an element exists in the DOM
	_inDOM( el ){
		// fallbacks
		el = el || this.el;
		// prerequisites
		if( !el ) return false;
		// variables
		var parent = document.querySelector( (this.options.parentEl || "body") );
		// check parent element
		var exists = parent.contains( el );
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

	// resize event trigger (debounced)
	// The timer has to live on the instance: it used to be a local `var timeout`,
	// so `clearTimeout( timeout )` always cleared `undefined` and every single
	// resize event scheduled its own callback - no debouncing at all.
	_resize () {
		var self = this;
		var args = Array.prototype.slice.call( arguments );
		var delay = ( this.options && this.options.resizeDelay ) || 1000;
		clearTimeout( this._resizeTimer );
		this._resizeTimer = setTimeout( function () {
			self._resizeTimer = null;
			self.resize.apply( self, args );
		}, delay );
	}

	//
	_scroll() {
		//this.state.set("scroll", true);
	}

	/**
	 * Subscribe to an event. Overridden so that asking for "visible" / "hidden"
	 * starts the IntersectionObserver - it is not created until something wants it.
	 * @param {string} name
	 * @param {EventCallback} callback
	 * @param {Object} [context]
	 * @returns {this}
	 */
	on( name, callback, context ){
		var result = super.on( name, callback, context );
		if( /(^|\s)(visible|hidden)(\s|$)/.test( String( name ) ) ) this._setupVisibilityObserver();
		return result;
	}

	// checks if the view is visible
	// (state is maintained natively by the IntersectionObserver, started here on
	// first use if nothing has subscribed to visible/hidden yet)
	isVisible(){
		this._setupVisibilityObserver();
		return this.state.get("visible");
	}

	// - visibility monitoring via the native IntersectionObserver API.
	// Replaces the expensive jQuery scroll/offset math: the browser delegates
	// this to the compositor thread at effectively zero main-thread cost, and
	// emits "visible"/"hidden" as the element enters/leaves the viewport.
	_setupVisibilityObserver(){
		if( this.observer ) return;
		if( typeof IntersectionObserver === "undefined" || !this.el ) return;
		var self = this;
		this.observer = new IntersectionObserver(function( entries ){
			entries.forEach(function( entry ){
				var visible = entry.isIntersecting;
				if( visible !== self.state.get("visible") ){
					self.state.set("visible", visible);
					self.trigger( visible ? "visible" : "hidden" );
				}
			});
		});
		this.observer.observe( this.el );
	}

	/**
	 * Tear the view down: drop all listenTo bindings, stop the visibility
	 * observer, and detach the element from the DOM.
	 * @returns {this}
	 */
	remove(){
		// remove all listenTo bindings (data, template, ...) to avoid leaks
		this.stopListening();
		// drop the delegated DOM listeners too, so a re-used element is clean
		this.undelegateEvents();
		// leave the shared resize registry
		unwatchResize( this );
		if( this.observer ) this.observer.disconnect();
		if( this.el && this.el.parentNode ) this.el.parentNode.removeChild( this.el );
		// let Base remove the resize listener etc.
		super.remove();
	}

}

export { View };
