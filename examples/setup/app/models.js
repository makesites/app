import { APP, Model } from "../../../dist/app.js";

class User extends Model {

	// a computed url for fetch()/save() (native fetch under the hood)
	get url(){ return "/api/user"; }

}

// save in the APP namespace
APP.Models.User = User;

export { User };
