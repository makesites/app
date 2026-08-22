import { APP, Controller } from "../../../dist/app.js";

// The default controller. The base Controller already maps the "" route to
// index(), so we just override index() to mount a view. (Declaring a NEW routes
// hash on a subclass is a known rough edge - see the README "Status" section.)
class Default extends Controller {

	index(){
		// data
		const user = new APP.Models.User({ name: "Ada" });
		// view, bound to the model (auto-renders on change)
		const view = new APP.Views.Profile({ el: "#main", model: user });
		// register it in the app-wide view registry
		this.app.views.add("profile", view);
	}
}

// save in the APP namespace (picked up as the default controller)
APP.Controllers.Default = Default;

export { Default };
