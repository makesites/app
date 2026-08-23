
class Controller extends Router {

	/**
	 * @param {Object} [options] - { api, autostart, pushState, location, p404, session, app }
	 */
	constructor( options ) {
		// fallback(s) - must run before super()
		options = options || {};
		// inherit the native Router/History routing engine
		super( options );

		this.data = new Model();

		// app config refered to as options: the framework's built-in defaults,
		// then a subclass `defaults` (getter or property), then the caller's
		// options. (The built-ins used to be assigned to `this.defaults`, so a
		// subclass declaring `get defaults()` threw in the constructor.)
		options = options || {};
		this.options = _.extend({}, this._optionDefaults(), _.result(this, 'defaults'), options);

		// built-in routes, merged UNDER any subclass routes at bind time (see
		// _bindRoutes). Kept as _baseRoutes so a subclass can declare `get routes()`
		// without colliding with a constructor assignment.
		this._baseRoutes = {
			"": "index",
			"_=_": "_fixFB",
			"access_token=:token": "access_token",
			"logout": "logout"
			//"*path"  : "_404"
		};

		// app reference + shared environment state. Owned by the APP facade;
		// falls back to a standalone state object when used without APP.
		this.app = options.app || null;
		this.state = this.app ? this.app.state : createState();

		this.cid = _.uniqueId("controller");

		this.initialize();

	}

	// framework option defaults, kept internal so a subclass can declare
	// `get defaults()` (mirrors Model#_optionDefaults / Collection#_optionDefaults)
	_optionDefaults(){
		return {
			api : false,
			autostart: true,
			location : false,
			pushState: false,
			p404 : "/"
		};
	}

	initialize(){
		// setup app
		this._setup();
		// bind the declared routes to the native history engine
		this._bindRoutes();
		// start monitoring the URL for changes
		if( this.options.autostart && typeof window !== "undefined" ) history.start({ pushState: this.options.pushState });
	}

	update(){
		// backwards compatibility for a simple state object
		var scroll = (this.state instanceof Model ) ? this.state.get("scroll") : this.state.scroll;
		if( scroll ){
			document.body.classList.remove("no-scroll");
		} else {
			document.body.classList.add("no-scroll");
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
		// - keep the online/offline state in sync
		this._setupConnectivity();
		// - intercept internal links for SPA navigation (when using pushState)
		if( this.options.pushState ) this._setupLinks();
		// - setup session
		this._setupSession();
	}

	// keep state.online in sync with the browser connectivity, emitting
	// "online"/"offline" so the app can react (replaces UA/navigator polling)
	_setupConnectivity(){
		if( typeof window === "undefined" ) return;
		var self = this;
		window.addEventListener("online", function(){
			self.state.online = true;
			self.trigger("online");
		});
		window.addEventListener("offline", function(){
			self.state.online = false;
			self.trigger("offline");
		});
	}

	// intercept clicks on internal links and route them through history,
	// avoiding full-page reloads (native port of the legacy layout _clickLink)
	_setupLinks(){
		if( typeof document === "undefined" ) return;
		var self = this;
		document.body.addEventListener("click", function( e ){
			var link = e.target.closest("a");
			if( !link ) return;
			var href = link.getAttribute("href");
			// ignore external links, new-tab links, in-page anchors and absolute urls
			var external = link.getAttribute("rel") === "external" || link.getAttribute("target");
			if( !href || external || href.charAt(0) === "#" || /^https?:\/\//.test(href) ) return;
			// only handle root-relative internal paths
			if( href.charAt(0) !== "/" ) return;
			e.preventDefault();
			self.navigate( href, { trigger: true } );
		});
	}

	// - setup session: reuse the app-owned session, or create one when
	//   configured standalone (opt-in via options.session)
	_setupSession(){
		if( this.app && this.app.session ){ this.session = this.app.session; return; }
		if( !this.options.session ) return;
		var SessionClass = APP.Session || Session;
		if( SessionClass ) this.session = new SessionClass( {}, this.options.session );
	}

	// set the api base url (+ credentials + CSRF) for all sync requests
	// native replacement for the old jQuery $.ajaxPrefilter
	_ajaxPrefilter( api ){
		var self = this;
		configureSync({
			// prepend the API base to relative URLs
			base: api,
			// send cookies (servers that set Access-Control-Allow-Credentials: true)
			credentials: "include",
			// attach the CSRF token from the session, when available
			headers: function(){
				var session = self.session || false;
				var csrf = ( session ) ? ( session._csrf || session.get('_csrf') || false ) : false;
				return csrf ? { "X-CSRF-Token": csrf } : {};
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
		// resolve routes: built-ins + subclass (getter/property) + options,
		// without assigning `this.routes` (so subclass getters don't throw)
		var routes = _.extend({}, this._baseRoutes, _.result(this, 'routes'), this._optionRoutes);
		var route, names = Object.keys(routes);
		while(typeof (route = names.pop()) !== "undefined"){
			var name = routes[route];
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
