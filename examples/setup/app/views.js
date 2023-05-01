import { APP, View } from "/build/app.js";

class Profile extends View {

	constructor( options ) {
		super( options );

		console.log("view init");
	}

}

// save in APP namespace
APP.Views.Profile = Profile;


export { Profile };
