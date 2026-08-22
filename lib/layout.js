
class Layout extends View {

	constructor( options ) {
		// fallback(s)
		options = options || {};
		// the layout binds to <body> by default
		options.el = options.el || "body";
		// merge the layout defaults under any caller options
		options = _.extend({
			autosync : false,
			autorender: true,
			sync_events: "add remove change"
		}, options);
		// inherit View (resolves this.el, this.state, runs initialize())
		super( options );

		// layout identity + a truly-delegated link handler on the root element
		this.cid = _.uniqueId("layout");
		var self = this;
		this._onClick = function( e ){ self._clickLink( e ); };
		this.el.addEventListener("click", this._onClick);
	}

	initialize(){
		// container for registered child views (a plain map, not a Model:
		// views hold DOM nodes / circular refs that don't belong in attributes)
		this.views = {};

		// re-render the layout when an "update" is triggered
		this.on("update", this.update, this);

		// #77 using the url option to compile a shell template
		if( this.options.url || this.url ){
			var url = this.options.url || this.url;
			// set the type to default (as the Template expects)
			if( !this.options.type ) this.options.type = "default";
			this.template = new Template(null, { url : url });
			if( this.options.autorender ) this.template.on("loaded", this.render, this);
		}
		// (this.data is already resolved by the View constructor)
	}

	preRender(){

	}

	render(){
		this._preRender();
		// remove loading class (if any)
		this.el.classList.remove("loading");

		// creating html if required
		if( this.template ){
			var template = ( this.options.type ) ? this.template.get( this.options.type ) : this.template;
			// use the options as data..
			var html = ( template instanceof Function ) ? template( this.options ) : template;
			this.el.innerHTML = html;
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
			for( var i in this.views ){
				if( typeof this.views[i]._navigate === "function" ) this.views[i]._navigate(e);
			}
		}
		// - include other conditions...
	}

	// setter and getter mirroring the Model methods
	set( views ){
		// add event triggers on the views
		for( var i in views ){
			views[i].on("loaded", this._viewLoaded, this );
			// 'stamp' each view with a label
			views[i]._name = i;
			// bind events
			if( views[i].data ) {
				// view reference in the data
				views[i].data._view = i;
				// bind all data updates to the layout
				views[i].data.on( this.options.sync_events, this._syncData, this );
			}
			// register the view
			this.views[i] = views[i];
		}
		return this.views;
	}

	get( view ){
		return this.views[ view ];
	}

	// removes a view
	remove( name ){
		var view = this.get( name );
		// prerequisite
		if( _.isUndefined(view) ) return;
		// undelegate view events
		view.remove();
		// remove the reference from this.views
		delete this.views[ name ];
	}

	findLink( target ) {
		var link = (target.tagName != "A") ? target.closest("a") : target;
		if( !link ) return false;
		var url = link.getAttribute("href");
		// filter some URLs
		// - defining local URLs
		var isLocal = (url) ? ( url.substr(0,1) == "#" || (url.substr(0,2) == "/#" && window.location.pathname == "/" ) ) : false;
		return ( _.isEmpty(url) || isLocal || link.getAttribute("target") ) ? false : url;
	}

	// Internal methods
	_preRender(){
		// add touch class to body (when the app global exposes it)
		if( typeof app !== "undefined" && app.state && app.state.touch ) this.el.classList.add("touch");
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
		_.each(this.views, function( view ){
			if( view.state && view.state.get && view.state.get("loaded") ) loaded++;
			registered++;
		});

		// when all views are loaded...
		if( registered && registered == loaded ){
			this._allViewsLoaded();
		}

	}

	// what to do after all views are loaded (once)
	_allViewsLoaded(){
		if( this._loaded ) return;
		this._loaded = true;
		// re-render the layout
		this.render();
	}

	// broadcast all data updates in the views back to the layout
	_syncData( model, collection, options ){
		var value = false;
		// fallback
		var data = collection || model || false;
		if( !data ) return;
		// get the key of the data
		var key = data._view || false;
		// if we haven't kept a reference key to backtrack, exit now
		if( !key ) return;
		// this automation only works when the layout data is a Model
		if( this.model instanceof Model ){
			var keys = Object.keys( this.model.attributes ) || [];
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
		var link = e.target.closest("a");
		// let external / alternate links pass through untouched
		if( link ){
			var rel = link.getAttribute("rel");
			if( rel === "external" || rel === "alternate" ) return;
		}
		var url = this.findLink(e.target);
		if( url ){
			// add loading class
			this.el.classList.add("loading");
		}
		// when to intercept links (standalone / app mode)
		if( url && typeof app !== "undefined" && app.state && typeof app.state.standalone === "function" && app.state.standalone() ){
			// block default behavior
			e.preventDefault();
			//
			window.location = url;
			return false;
		}
		// otherwise pass through...
	}

}
