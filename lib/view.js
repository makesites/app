
class View extends Base {

	constructor( options ){
		// fallback(s)
		options = options || {};
		//
		super( options );
		// element
		this.el = this._getEl( options );
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

		this.initialize();
	}

	initialize(){
		var self = this;
		// unbind this container from any previous listeners
		this.unbind();
		//
		//_.bindAll(this, 'render', 'clickExternal', 'postRender', 'onLoaded', '_url', '_inDOM', '_toJSON', '_onLoaded');
		//if( typeof this.url == "function" ) _.bindAll(this, 'url');
		// find the data
		this.data = this.data || this.model || this.collection || null;
		this.options.data  = !_.isNull( this.data );
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
