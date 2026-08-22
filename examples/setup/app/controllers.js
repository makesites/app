import { APP, Controller } from "../../../dist/app.js";

// The default controller. Declare routes with a `routes` getter (merged over the
// built-in routes); guard them by overriding execute().
class Default extends Controller {

	get routes(){
		return {
			"": "index",
			"profile": "profile"
		};
	}

	index(){
		// data
		const user = new APP.Models.User({ name: "Ada" });
		// view, bound to the model (auto-renders on change)
		const view = new APP.Views.Profile({ el: "#main", model: user });
		// register it in the app-wide view registry
		this.app.views.add("profile", view);
	}

	profile(){
		// publish on the shared bus - any UI can react, in this tab or another
		this.app.events.trigger("profile:open", "Ada");
	}

	// route guard: cancel a route by returning false (toggle `this.authed` to test)
	execute( callback, args, name ){
		if( name === "profile" && !this.authed ){
			console.warn("blocked: /profile (not authenticated)");
			return false;
		}
		return super.execute( callback, args, name );
	}
}

// save in the APP namespace (picked up as the default controller)
APP.Controllers.Default = Default;

export { Default };
