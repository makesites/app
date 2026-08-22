import { APP, View } from "../../../dist/app.js";

class Profile extends View {

	// Override render(). The base View binds the model's change events via
	// listenTo, so this re-runs automatically when the model changes - and the
	// bindings are cleaned up when the view is removed.
	render(){
		const data = this.model ? this.model.toJSON() : {};
		this.el.innerHTML = `<h2>Hello, ${data.name || "Guest"}</h2>`;
		return this;
	}

}

// save in the APP namespace
APP.Views.Profile = Profile;

export { Profile };
