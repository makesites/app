import { APP, Model } from "/build/app.js";

class User extends Model {

	constructor( model, options ) {
		super( options );

		console.log("model init");
	}

}

// save in APP namespace
APP.Models.User = User;


export { User };
